import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

interface JobExecutionContext {
  jobId: string;
  queueId: string;
  workerId: string;
  attempt: number;
  timeoutHandle?: NodeJS.Timeout;
}

@Injectable()
export class WorkerEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerEngine.name);
  private readonly workerId: string;
  private readonly workerName: string;
  private running = false;
  private activeContexts = new Map<string, JobExecutionContext>();
  private heartbeatInterval?: NodeJS.Timeout;
  private pollInterval?: NodeJS.Timeout;
  private delayedJobInterval?: NodeJS.Timeout;
  private staleJobInterval?: NodeJS.Timeout;
  private readonly concurrency: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    this.workerId = uuidv4();
    this.workerName = `worker-${process.env.HOSTNAME ?? 'local'}-${process.pid}`;
    this.concurrency = Number(config.get('WORKER_CONCURRENCY', 5));
  }

  async onModuleInit() {
    await this.registerWorker();
    this.running = true;
    this.startHeartbeat();
    this.startPolling();
    this.startDelayedJobPromotion();
    this.startStaleJobReclaim();
    this.logger.log(`Worker ${this.workerName} (${this.workerId}) started`);
  }

  async onModuleDestroy() {
    this.running = false;
    clearInterval(this.heartbeatInterval);
    clearInterval(this.pollInterval);
    clearInterval(this.delayedJobInterval);
    clearInterval(this.staleJobInterval);

    // Graceful drain: wait for active jobs to finish (max 30s)
    await this.drain(30000);

    await this.prisma.worker.update({
      where: { id: this.workerId },
      data: { status: 'OFFLINE', stoppedAt: new Date() },
    });
    this.logger.log(`Worker ${this.workerName} gracefully stopped`);
  }

  private async registerWorker() {
    await this.prisma.worker.upsert({
      where: { id: this.workerId },
      create: {
        id: this.workerId,
        name: this.workerName,
        hostname: process.env.HOSTNAME ?? 'localhost',
        pid: process.pid,
        queues: [],
        status: 'ONLINE',
        concurrency: this.concurrency,
        lastHeartbeat: new Date(),
      },
      update: {
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        stoppedAt: null,
      },
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        const activeJobs = this.activeContexts.size;

        await Promise.all([
          this.prisma.worker.update({
            where: { id: this.workerId },
            data: {
              lastHeartbeat: new Date(),
              status: activeJobs > 0 ? 'BUSY' : 'IDLE',
            },
          }),
          this.redis.setWorkerHeartbeat(this.workerId, {
            activeJobs,
            memoryMb: Math.round(memUsage),
            timestamp: Date.now(),
          }),
          this.prisma.workerHeartbeat.create({
            data: {
              workerId: this.workerId,
              activeJobs,
              memoryUsage: Math.round(memUsage),
              cpuUsage: 0,
            },
          }),
        ]);
      } catch (err) {
        this.logger.error('Heartbeat failed', err);
      }
    }, 10000);
  }

  private startPolling() {
    this.pollInterval = setInterval(async () => {
      if (!this.running) return;
      if (this.activeContexts.size >= this.concurrency) return;

      try {
        await this.pollQueues();
      } catch (err) {
        this.logger.error('Poll failed', err);
      }
    }, 1000);
  }

  private startDelayedJobPromotion() {
    this.delayedJobInterval = setInterval(async () => {
      try {
        await this.promoteDelayedJobs();
      } catch (err) {
        this.logger.error('Delayed job promotion failed', err);
      }
    }, 5000);
  }

  private startStaleJobReclaim() {
    this.staleJobInterval = setInterval(async () => {
      try {
        await this.reclaimStaleJobs();
      } catch (err) {
        this.logger.error('Stale job reclaim failed', err);
      }
    }, 30000);
  }

  private async pollQueues() {
    // Get all active queues
    const queues = await this.prisma.queue.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { priority: 'desc' },
    });

    for (const queue of queues) {
      if (this.activeContexts.size >= this.concurrency) break;

      // Check rate limit
      if (queue.rateLimitCount && queue.rateLimitWindow) {
        const limited = await this.redis.isRateLimited(
          queue.id,
          queue.rateLimitCount,
          queue.rateLimitWindow,
        );
        if (limited) continue;
      }

      const jobId = await this.redis.claimNextJob(queue.id, this.workerId);
      if (!jobId) continue;

      // Verify job exists and is in QUEUED state
      const job = await this.prisma.job.findFirst({
        where: { id: jobId, queueId: queue.id, status: { in: ['QUEUED', 'RETRYING'] } },
        include: { queue: { include: { retryPolicy: true } } },
      });

      if (!job) {
        await this.redis.releaseClaimedJob(queue.id, jobId);
        continue;
      }

      // Atomically claim in DB
      const claimed = await this.prisma.job.updateMany({
        where: { id: jobId, status: { in: ['QUEUED', 'RETRYING'] } },
        data: { status: 'CLAIMED', workerId: this.workerId },
      });

      if (claimed.count === 0) {
        await this.redis.releaseClaimedJob(queue.id, jobId);
        continue;
      }

      // Execute asynchronously
      this.executeJob(job).catch((err) => {
        this.logger.error(`Unhandled error in job ${jobId}`, err);
      });
    }
  }

  private async executeJob(job: any) {
    const ctx: JobExecutionContext = {
      jobId: job.id,
      queueId: job.queueId,
      workerId: this.workerId,
      attempt: job.retryCount + 1,
    };

    this.activeContexts.set(job.id, ctx);

    const execution = await this.prisma.jobExecution.create({
      data: {
        jobId: job.id,
        workerId: this.workerId,
        attempt: ctx.attempt,
        status: 'RUNNING',
      },
    });

    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    this.events.emit('job.started', {
      jobId: job.id,
      queueId: job.queueId,
      projectId: job.queue.projectId,
    });

    const startTime = Date.now();

    try {
      // Set timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        ctx.timeoutHandle = setTimeout(() => {
          reject(new Error(`Job timed out after ${job.timeout}ms`));
        }, job.timeout);
      });

      // Simulate actual job execution (in real system, would call registered handler)
      const result = await Promise.race([
        this.runJobHandler(job),
        timeoutPromise,
      ]);

      clearTimeout(ctx.timeoutHandle);

      const duration = Date.now() - startTime;

      await Promise.all([
        this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            result: result ?? {},
          },
        }),
        this.prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            duration,
            result: result ?? {},
          },
        }),
        this.redis.releaseClaimedJob(job.queueId, job.id),
        this.prisma.jobLog.create({
          data: {
            jobId: job.id,
            level: 'info',
            message: `Job completed in ${duration}ms`,
            metadata: { duration, attempt: ctx.attempt },
          },
        }),
      ]);

      this.events.emit('job.completed', {
        jobId: job.id,
        queueId: job.queueId,
        projectId: job.queue.projectId,
        duration,
      });
    } catch (error: any) {
      clearTimeout(ctx.timeoutHandle);
      const duration = Date.now() - startTime;
      const errorMsg = error?.message ?? 'Unknown error';
      const errorStack = error?.stack;

      await this.prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          duration,
          error: errorMsg,
        },
      });

      await this.redis.releaseClaimedJob(job.queueId, job.id);

      const retryPolicy = job.queue.retryPolicy;
      const canRetry = job.retryCount < job.maxRetries;

      if (canRetry) {
        const delay = this.calculateRetryDelay(
          job.retryCount,
          retryPolicy?.strategy ?? 'EXPONENTIAL',
          retryPolicy?.initialDelay ?? 1000,
          retryPolicy?.maxDelay ?? 30000,
          retryPolicy?.backoffMultiple ?? 2.0,
        );

        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'RETRYING',
            retryCount: job.retryCount + 1,
            workerId: null,
            errorMessage: errorMsg,
            errorStack,
          },
        });

        await this.redis.requeueJob(job.queueId, job.id, job.priority, delay);

        await this.prisma.jobLog.create({
          data: {
            jobId: job.id,
            level: 'warn',
            message: `Job failed, retrying in ${delay}ms (attempt ${job.retryCount + 1}/${job.maxRetries})`,
            metadata: { error: errorMsg, delay, attempt: ctx.attempt },
          },
        });

        this.events.emit('job.retrying', {
          jobId: job.id,
          queueId: job.queueId,
          projectId: job.queue.projectId,
          attempt: job.retryCount + 1,
          delay,
        });
      } else {
        // Move to dead letter queue
        await this.prisma.$transaction([
          this.prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'DEAD',
              failedAt: new Date(),
              errorMessage: errorMsg,
              errorStack,
            },
          }),
          this.prisma.deadLetterQueue.upsert({
            where: { jobId: job.id },
            create: {
              jobId: job.id,
              queueId: job.queueId,
              reason: errorMsg,
              payload: job.payload,
              errorMessage: errorMsg,
              retryCount: job.retryCount,
            },
            update: {
              reason: errorMsg,
              retryCount: job.retryCount,
            },
          }),
        ]);

        await this.prisma.jobLog.create({
          data: {
            jobId: job.id,
            level: 'error',
            message: `Job moved to dead letter queue after ${job.retryCount} retries`,
            metadata: { error: errorMsg, stack: errorStack },
          },
        });

        this.events.emit('job.dead', {
          jobId: job.id,
          queueId: job.queueId,
          projectId: job.queue.projectId,
        });
      }
    } finally {
      this.activeContexts.delete(job.id);
    }
  }

  private async runJobHandler(job: any): Promise<Record<string, any>> {
    // In a real distributed system, this would dispatch to a registered handler
    // For demonstration, we simulate processing based on job type/name
    const delay = Math.random() * 2000 + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Simulate random failures for testing (5% failure rate)
    if (Math.random() < 0.05) {
      throw new Error(`Simulated processing failure for job: ${job.name}`);
    }

    return {
      processedAt: new Date().toISOString(),
      workerId: this.workerId,
      jobName: job.name,
      executionTime: Math.round(delay),
    };
  }

  private calculateRetryDelay(
    attempt: number,
    strategy: string,
    initialDelay: number,
    maxDelay: number,
    multiplier: number,
  ): number {
    let delay: number;
    switch (strategy) {
      case 'FIXED':
        delay = initialDelay;
        break;
      case 'LINEAR':
        delay = initialDelay * (attempt + 1);
        break;
      case 'EXPONENTIAL':
      default:
        delay = initialDelay * Math.pow(multiplier, attempt);
        break;
    }
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.min(Math.round(delay + jitter), maxDelay);
  }

  private async promoteDelayedJobs() {
    const queues = await this.prisma.queue.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const queue of queues) {
      const dueJobIds = await this.redis.getDelayedJobsDue(queue.id);
      for (const jobId of dueJobIds) {
        await this.redis.pushToQueue(queue.id, jobId, 5);
        await this.prisma.job.updateMany({
          where: { id: jobId, status: 'RETRYING' },
          data: { status: 'QUEUED' },
        });
      }
    }

    // Also promote DB-scheduled jobs
    const now = new Date();
    const scheduledJobs = await this.prisma.job.findMany({
      where: {
        status: 'SCHEDULED',
        runAt: { lte: now },
        type: { in: ['DELAYED'] },
      },
      include: { queue: { select: { status: true } } },
      take: 100,
    });

    for (const job of scheduledJobs) {
      if (job.queue.status !== 'ACTIVE') continue;
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: 'QUEUED' },
      });
      await this.redis.pushToQueue(job.queueId, job.id, job.priority);
    }
  }

  private async reclaimStaleJobs() {
    // Find workers that haven't sent heartbeat in 60s
    const threshold = new Date(Date.now() - 60000);
    const staleWorkers = await this.prisma.worker.findMany({
      where: {
        status: { in: ['ONLINE', 'BUSY', 'IDLE'] },
        lastHeartbeat: { lt: threshold },
        id: { not: this.workerId },
      },
    });

    if (staleWorkers.length === 0) return;

    for (const worker of staleWorkers) {
      this.logger.warn(`Worker ${worker.id} is stale, reclaiming jobs`);

      await this.prisma.worker.update({
        where: { id: worker.id },
        data: { status: 'OFFLINE', stoppedAt: new Date() },
      });

      const staleJobs = await this.prisma.job.findMany({
        where: { workerId: worker.id, status: { in: ['CLAIMED', 'RUNNING'] } },
      });

      for (const job of staleJobs) {
        await this.prisma.job.update({
          where: { id: job.id },
          data: { status: 'QUEUED', workerId: null },
        });
        await this.redis.pushToQueue(job.queueId, job.id, job.priority);

        await this.prisma.jobLog.create({
          data: {
            jobId: job.id,
            level: 'warn',
            message: `Job reclaimed from dead worker ${worker.id}`,
          },
        });
      }

      this.events.emit('worker.died', { workerId: worker.id });
    }
  }

  private async drain(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (this.activeContexts.size > 0 && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (this.activeContexts.size > 0) {
      this.logger.warn(
        `Drain timeout. ${this.activeContexts.size} jobs still running. Forcing shutdown.`,
      );
    }
  }

  getStatus() {
    return {
      workerId: this.workerId,
      name: this.workerName,
      activeJobs: this.activeContexts.size,
      concurrency: this.concurrency,
      running: this.running,
    };
  }
}
