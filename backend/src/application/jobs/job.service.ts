import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  CreateJobDto,
  BulkCreateJobDto,
  RetryJobDto,
  JobQueryDto,
  JobType,
} from './dto/job.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
  ) {}

  async createJob(queueId: string, dto: CreateJobDto, userId?: string) {
    const queue = await this.prisma.queue.findUnique({
      where: { id: queueId },
      include: { retryPolicy: true },
    });
    if (!queue) throw new NotFoundException('Queue not found');
    if (queue.status === 'PAUSED') throw new BadRequestException('Queue is paused');
    if (queue.status === 'ARCHIVED') throw new BadRequestException('Queue is archived');

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.job.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return { job: existing, idempotent: true };
      }
    }

    const status =
      dto.type === JobType.DELAYED || dto.type === JobType.CRON || dto.type === JobType.RECURRING
        ? 'SCHEDULED'
        : 'QUEUED';

    const job = await this.prisma.job.create({
      data: {
        queueId,
        createdById: userId,
        name: dto.name,
        type: dto.type ?? 'IMMEDIATE',
        status,
        priority: dto.priority ?? 5,
        payload: dto.payload ?? {},
        headers: dto.headers ?? {},
        tags: dto.tags ?? [],
        cronExpression: dto.cronExpression,
        scheduledAt: dto.runAt ? new Date(dto.runAt) : null,
        runAt: dto.runAt ? new Date(dto.runAt) : null,
        timeout: dto.timeout ?? 30000,
        maxRetries: dto.maxRetries ?? queue.retryPolicy?.maxRetries ?? 3,
        idempotencyKey: dto.idempotencyKey,
        batchId: dto.batchId,
        parentJobId: dto.parentJobId,
      },
    });

    // Push to Redis queue for immediate dispatch
    if (status === 'QUEUED') {
      await this.redis.pushToQueue(queueId, job.id, dto.priority ?? 5);
    }

    await this.prisma.jobLog.create({
      data: {
        jobId: job.id,
        level: 'info',
        message: `Job created with status ${status}`,
        metadata: { userId, type: dto.type },
      },
    });

    this.events.emit('job.created', { job, queueId, projectId: queue.projectId });
    return { job, idempotent: false };
  }

  async createBulkJobs(queueId: string, dto: BulkCreateJobDto, userId?: string) {
    const batchId = dto.batchId ?? uuidv4();
    const results = await Promise.all(
      dto.jobs.map((jobDto) =>
        this.createJob(queueId, { ...jobDto, batchId }, userId),
      ),
    );
    return { batchId, jobs: results.map((r) => r.job), count: results.length };
  }

  async getJobs(queueId: string, query: JobQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const where: any = { queueId };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.batchId) where.batchId = query.batchId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { id: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const allowedSort = ['createdAt', 'priority', 'status', 'updatedAt'];
    const orderBy = allowedSort.includes(sortBy) ? { [sortBy]: sortOrder } : { createdAt: 'desc' as const };

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          executions: { orderBy: { startedAt: 'desc' }, take: 1 },
          _count: { select: { logs: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { jobs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        executions: { orderBy: { startedAt: 'desc' } },
        logs: { orderBy: { createdAt: 'desc' }, take: 50 },
        deadLetter: true,
        queue: { select: { name: true, projectId: true, retryPolicy: true } },
        worker: { select: { name: true, hostname: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async retryJob(jobId: string, dto?: RetryJobDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { queue: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (!['FAILED', 'DEAD', 'CANCELLED'].includes(job.status)) {
      throw new BadRequestException('Only FAILED, DEAD, or CANCELLED jobs can be retried');
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        retryCount: 0,
        workerId: null,
        errorMessage: null,
        errorStack: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        payload: (dto?.payload ? dto.payload : job.payload) as any,
      },
    });

    await this.redis.pushToQueue(job.queueId, jobId, job.priority);

    await this.prisma.jobLog.create({
      data: {
        jobId,
        level: 'info',
        message: 'Job manually retried',
        metadata: { payload: dto?.payload },
      },
    });

    this.events.emit('job.retried', { jobId, queueId: job.queueId, projectId: job.queue.projectId });
    return updated;
  }

  async cancelJob(jobId: string, reason?: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { queue: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (['COMPLETED', 'CANCELLED', 'DEAD'].includes(job.status)) {
      throw new BadRequestException('Job is already in terminal state');
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    await this.redis.removeFromQueue(job.queueId, jobId);

    await this.prisma.jobLog.create({
      data: {
        jobId,
        level: 'warn',
        message: `Job cancelled: ${reason ?? 'No reason provided'}`,
      },
    });

    this.events.emit('job.cancelled', { jobId, queueId: job.queueId, projectId: job.queue.projectId });
    return updated;
  }

  async getJobLogs(jobId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.jobLog.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobLog.count({ where: { jobId } }),
    ]);
    return { logs, total, page, limit };
  }

  async getDeadLetterQueue(projectId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.deadLetterQueue.findMany({
        where: { job: { queue: { projectId } } },
        include: { job: { include: { queue: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.deadLetterQueue.count({
        where: { job: { queue: { projectId } } },
      }),
    ]);
    return { items, total, page, limit };
  }

  async requeueDeadLetterJob(dlqId: string) {
    const dlq = await this.prisma.deadLetterQueue.findUnique({
      where: { id: dlqId },
      include: { job: { include: { queue: true } } },
    });
    if (!dlq) throw new NotFoundException('DLQ entry not found');
    if (dlq.requeued) throw new BadRequestException('Job already requeued');

    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: dlq.jobId },
        data: { status: 'QUEUED', retryCount: 0, workerId: null },
      }),
      this.prisma.deadLetterQueue.update({
        where: { id: dlqId },
        data: { requeued: true, requeuedAt: new Date() },
      }),
    ]);

    await this.redis.pushToQueue(dlq.job.queueId, dlq.jobId, dlq.job.priority);
    return { success: true };
  }
}
