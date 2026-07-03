import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('Metrics & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get system-wide dashboard metrics' })
  async getDashboard() {
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
        select: { duration: true, status: true, startedAt: true },
      }),
    ]);

    const avgDuration =
      recentExecutions
        .filter((e) => e.duration)
        .reduce((s, e) => s + (e.duration ?? 0), 0) /
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

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get project-level metrics' })
  async getProjectMetrics(@Param('projectId') projectId: string) {
    const queues = await this.prisma.queue.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });

    const queueIds = queues.map((q) => q.id);

    const [jobsByStatus, recentActivity, queueMetrics] = await Promise.all([
      this.prisma.job.groupBy({
        by: ['status'],
        where: { queueId: { in: queueIds } },
        _count: true,
      }),
      this.prisma.jobExecution.findMany({
        where: { job: { queueId: { in: queueIds } } },
        orderBy: { startedAt: 'desc' },
        take: 200,
        select: { status: true, duration: true, startedAt: true },
      }),
      this.prisma.queueMetric.findMany({
        where: { queueId: { in: queueIds } },
        orderBy: { recordedAt: 'desc' },
        take: queueIds.length * 12,
      }),
    ]);

    return { queues, jobsByStatus, recentActivity, queueMetrics };
  }

  @Get('throughput')
  @ApiOperation({ summary: 'Get throughput over time (hourly)' })
  async getThroughput(@Query('hours') hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const executions = await this.prisma.jobExecution.findMany({
      where: { startedAt: { gte: since } },
      select: { status: true, startedAt: true, duration: true },
    });

    // Bucket by hour
    const buckets: Record<string, { completed: number; failed: number; total: number; totalDuration: number }> = {};
    for (const e of executions) {
      const hour = new Date(e.startedAt);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      if (!buckets[key]) buckets[key] = { completed: 0, failed: 0, total: 0, totalDuration: 0 };
      buckets[key].total++;
      if (e.status === 'COMPLETED') {
        buckets[key].completed++;
        buckets[key].totalDuration += e.duration ?? 0;
      }
      if (e.status === 'FAILED') buckets[key].failed++;
    }

    return Object.entries(buckets)
      .map(([time, data]) => ({
        time,
        ...data,
        avgDuration: data.completed > 0 ? Math.round(data.totalDuration / data.completed) : 0,
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }
}
