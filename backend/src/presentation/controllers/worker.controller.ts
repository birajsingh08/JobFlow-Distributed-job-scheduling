import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { WorkerEngine } from '../../infrastructure/workers/worker.engine';

@ApiTags('Workers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workers')
export class WorkerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly workerEngine: WorkerEngine,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all workers' })
  async findAll() {
    return this.prisma.worker.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      include: {
        _count: { select: { jobs: true, executions: true } },
        heartbeats: { orderBy: { recordedAt: 'desc' }, take: 5 },
      },
    });
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current worker engine status' })
  async status() {
    return this.workerEngine.getStatus();
  }

  @Get('active')
  @ApiOperation({ summary: 'List online workers only' })
  async active() {
    const threshold = new Date(Date.now() - 30000);
    return this.prisma.worker.findMany({
      where: { status: { in: ['ONLINE', 'BUSY', 'IDLE'] }, lastHeartbeat: { gte: threshold } },
      include: { _count: { select: { jobs: true } } },
    });
  }
}
