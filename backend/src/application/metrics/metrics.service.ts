import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const [
      totalJobs,
      runningJobs,
      failedJobs,
      completedJobs,
      activeWorkers,
      totalQueues,
      deadLetterCount,
      recentExecutions,
    ] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: 'RUNNING' } }),
      this.prisma.job.count({ where: { status: 'FAILED' } }),
      this.prisma.job.count({ where: { status: 'COMPLETED' } }),
      this.prisma.worker.count({ where: { status: { in: ['ONLINE', 'BUSY', 'IDLE'] } } }),
      this.prisma.queue.count({ where: { status: 'ACTIVE' } }),
      this.prisma.deadLetterQueue.count({ where: { requeued: false } }),
      this.prisma.jobExecution.findMany({
        where: { completedAt: { not: null } },
        orderBy: { startedAt: 'desc' },
        take: 100,
        select: { duration: true, status: true },
      }),
    ]);

    const avgDuration =
      recentExecutions.filter((e) => e.duration).reduce((s, e) => s + (e.duration ?? 0), 0) /
      (recentExecutions.filter((e) => e.duration).length || 1);

    const successRate =
      recentExecutions.length > 0
        ? (recentExecutions.filter((e) => e.status === 'COMPLETED').length / recentExecutions.length) * 100
        : 0;

    return {
      totalJobs,
      runningJobs,
      failedJobs,
      completedJobs,
      queuedJobs: await this.prisma.job.count({ where: { status: 'QUEUED' } }),
      activeWorkers,
      totalQueues,
      deadLetterCount,
      avgDurationMs: Math.round(avgDuration),
      successRate: Math.round(successRate * 10) / 10,
    };
  }
}
