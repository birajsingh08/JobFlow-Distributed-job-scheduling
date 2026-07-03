import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateQueueDto, UpdateQueueDto } from './dto/queue.dto';

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async createQueue(projectId: string, dto: CreateQueueDto) {
    const existing = await this.prisma.queue.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Queue "${dto.name}" already exists`);

    const queue = await this.prisma.queue.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        priority: dto.priority ?? 5,
        maxConcurrency: dto.maxConcurrency ?? 5,
        rateLimitCount: dto.rateLimitCount,
        rateLimitWindow: dto.rateLimitWindow,
        retryPolicy: dto.retryPolicy
          ? {
              create: {
                maxRetries: dto.retryPolicy.maxRetries ?? 3,
                strategy: dto.retryPolicy.strategy ?? 'EXPONENTIAL',
                initialDelay: dto.retryPolicy.initialDelay ?? 1000,
                maxDelay: dto.retryPolicy.maxDelay ?? 30000,
                backoffMultiple: dto.retryPolicy.backoffMultiple ?? 2.0,
              },
            }
          : undefined,
      },
      include: { retryPolicy: true },
    });

    this.events.emit('queue.created', { queueId: queue.id, projectId });
    return queue;
  }

  async getQueues(projectId: string) {
    return this.prisma.queue.findMany({
      where: { projectId },
      include: {
        retryPolicy: true,
        _count: { select: { jobs: true } },
        metrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQueue(queueId: string) {
    const queue = await this.prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        retryPolicy: true,
        _count: { select: { jobs: true } },
        metrics: { orderBy: { recordedAt: 'desc' }, take: 10 },
      },
    });
    if (!queue) throw new NotFoundException('Queue not found');
    return queue;
  }

  async updateQueue(queueId: string, dto: UpdateQueueDto) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue) throw new NotFoundException('Queue not found');

    const { retryPolicy, ...queueData } = dto;

    const updated = await this.prisma.queue.update({
      where: { id: queueId },
      data: {
        ...queueData,
        retryPolicy: retryPolicy
          ? {
              upsert: {
                create: {
                  maxRetries: retryPolicy.maxRetries ?? 3,
                  strategy: retryPolicy.strategy ?? 'EXPONENTIAL',
                  initialDelay: retryPolicy.initialDelay ?? 1000,
                  maxDelay: retryPolicy.maxDelay ?? 30000,
                  backoffMultiple: retryPolicy.backoffMultiple ?? 2.0,
                },
                update: retryPolicy,
              },
            }
          : undefined,
      },
      include: { retryPolicy: true },
    });

    this.events.emit('queue.updated', { queueId, projectId: queue.projectId });
    return updated;
  }

  async deleteQueue(queueId: string) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue) throw new NotFoundException('Queue not found');
    await this.prisma.queue.delete({ where: { id: queueId } });
    this.events.emit('queue.deleted', { queueId, projectId: queue.projectId });
  }

  async pauseQueue(queueId: string) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue) throw new NotFoundException('Queue not found');
    if (queue.status === 'PAUSED') throw new BadRequestException('Queue is already paused');

    const updated = await this.prisma.queue.update({
      where: { id: queueId },
      data: { status: 'PAUSED' },
    });
    this.events.emit('queue.paused', { queueId, projectId: queue.projectId });
    return updated;
  }

  async resumeQueue(queueId: string) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue) throw new NotFoundException('Queue not found');
    if (queue.status !== 'PAUSED') throw new BadRequestException('Queue is not paused');

    const updated = await this.prisma.queue.update({
      where: { id: queueId },
      data: { status: 'ACTIVE' },
    });
    this.events.emit('queue.resumed', { queueId, projectId: queue.projectId });
    return updated;
  }

  async getQueueStats(queueId: string) {
    const [counts, latestMetric, recentJobs] = await Promise.all([
      this.prisma.job.groupBy({
        by: ['status'],
        where: { queueId },
        _count: true,
      }),
      this.prisma.queueMetric.findFirst({
        where: { queueId },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.jobExecution.findMany({
        where: { job: { queueId }, completedAt: { not: null } },
        orderBy: { startedAt: 'desc' },
        take: 100,
        select: { duration: true, startedAt: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const c of counts) {
      statusMap[c.status] = c._count;
    }

    const avgDuration =
      recentJobs.filter((j) => j.duration).reduce((sum, j) => sum + (j.duration ?? 0), 0) /
        (recentJobs.filter((j) => j.duration).length || 1);

    return {
      queueId,
      queued: statusMap['QUEUED'] ?? 0,
      scheduled: statusMap['SCHEDULED'] ?? 0,
      running: statusMap['RUNNING'] ?? 0,
      completed: statusMap['COMPLETED'] ?? 0,
      failed: statusMap['FAILED'] ?? 0,
      retrying: statusMap['RETRYING'] ?? 0,
      dead: statusMap['DEAD'] ?? 0,
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      avgDurationMs: Math.round(avgDuration),
      latestMetric,
    };
  }
}
