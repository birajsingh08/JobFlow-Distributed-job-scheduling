import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Croner from 'croner';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private cronJobs = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
  ) {}

  // Called on startup to load all active cron jobs
  async loadScheduledJobs(): Promise<void> {
    const scheduledJobs = await this.prisma.scheduledJob.findMany({
      where: { isActive: true },
    });

    for (const sj of scheduledJobs) {
      this.scheduleJob(sj);
    }
    this.logger.log(`Loaded ${scheduledJobs.length} scheduled cron jobs`);
  }

  scheduleJob(scheduledJob: {
    id: string;
    queueId: string;
    name: string;
    cronExpression: string;
    payload: any;
    headers: any;
    tags: string[];
    priority: number;
    maxRetries: number;
    timeout: number;
  }): void {
    if (this.cronJobs.has(scheduledJob.id)) {
      this.cronJobs.get(scheduledJob.id).stop();
    }

    try {
      const job = Croner(scheduledJob.cronExpression, async () => {
        await this.triggerScheduledJob(scheduledJob);
      });

      this.cronJobs.set(scheduledJob.id, job);
      this.logger.log(`Scheduled job ${scheduledJob.name} (${scheduledJob.cronExpression})`);
    } catch (err) {
      this.logger.error(`Failed to schedule job ${scheduledJob.id}`, err);
    }
  }

  unscheduleJob(scheduledJobId: string): void {
    const job = this.cronJobs.get(scheduledJobId);
    if (job) {
      job.stop();
      this.cronJobs.delete(scheduledJobId);
    }
  }

  private async triggerScheduledJob(scheduledJob: any): Promise<void> {
    try {
      const job = await this.prisma.job.create({
        data: {
          queueId: scheduledJob.queueId,
          name: scheduledJob.name,
          type: 'CRON',
          status: 'QUEUED',
          priority: scheduledJob.priority,
          payload: scheduledJob.payload,
          headers: scheduledJob.headers,
          tags: scheduledJob.tags,
          timeout: scheduledJob.timeout,
          maxRetries: scheduledJob.maxRetries,
        },
      });

      await this.redis.pushToQueue(scheduledJob.queueId, job.id, scheduledJob.priority);

      await this.prisma.scheduledJob.update({
        where: { id: scheduledJob.id },
        data: { lastRunAt: new Date(), nextRunAt: this.getNextRun(scheduledJob.cronExpression) },
      });

      this.events.emit('job.scheduled_triggered', { jobId: job.id, scheduledJobId: scheduledJob.id });
      this.logger.debug(`Triggered cron job ${scheduledJob.name}`);
    } catch (err) {
      this.logger.error(`Failed to trigger scheduled job ${scheduledJob.id}`, err);
    }
  }

  // Every minute: check DB-level recurring/cron jobs
  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledJobs(): Promise<void> {
    const now = new Date();
    const dueJobs = await this.prisma.scheduledJob.findMany({
      where: {
        isActive: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
    });

    for (const sj of dueJobs) {
      if (!this.cronJobs.has(sj.id)) {
        this.scheduleJob(sj);
      }
    }
  }

  // Collect queue metrics every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectQueueMetrics(): Promise<void> {
    try {
      const queues = await this.prisma.queue.findMany({ where: { status: 'ACTIVE' } });

      for (const queue of queues) {
        const counts = await this.prisma.job.groupBy({
          by: ['status'],
          where: { queueId: queue.id },
          _count: true,
        });

        const statusMap: Record<string, number> = {};
        for (const c of counts) {
          statusMap[c.status] = c._count;
        }

        const recentExecutions = await this.prisma.jobExecution.findMany({
          where: {
            job: { queueId: queue.id },
            completedAt: { not: null },
            startedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          select: { duration: true },
        });

        const avgDuration =
          recentExecutions.filter((e) => e.duration).reduce((s, e) => s + (e.duration ?? 0), 0) /
          (recentExecutions.filter((e) => e.duration).length || 1);

        await this.prisma.queueMetric.create({
          data: {
            queueId: queue.id,
            totalJobs: Object.values(statusMap).reduce((a, b) => a + b, 0),
            completedJobs: statusMap['COMPLETED'] ?? 0,
            failedJobs: statusMap['FAILED'] ?? 0,
            pendingJobs: (statusMap['QUEUED'] ?? 0) + (statusMap['SCHEDULED'] ?? 0),
            runningJobs: statusMap['RUNNING'] ?? 0,
            avgDuration: Math.round(avgDuration),
            throughput: recentExecutions.length / 5,
          },
        });
      }
    } catch (err) {
      this.logger.error('Metrics collection failed', err);
    }
  }

  private getNextRun(cronExpression: string): Date | null {
    try {
      const job = Croner(cronExpression);
      return job.nextRun();
    } catch {
      return null;
    }
  }
}
