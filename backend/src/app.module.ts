import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Infrastructure
import { PrismaModule } from './infrastructure/database/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { WorkerModule } from './infrastructure/workers/worker.module';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module';

// Application
import { AuthModule } from './application/auth/auth.module';
import { ProjectModule } from './application/projects/project.module';
import { QueueModule } from './application/queues/queue.module';
import { JobModule } from './application/jobs/job.module';

// Presentation — Controllers
import { AuthController } from './presentation/controllers/auth.controller';
import { OrganizationController, ProjectController } from './presentation/controllers/project.controller';
import { QueueController } from './presentation/controllers/queue.controller';
import { JobController, DLQController } from './presentation/controllers/job.controller';
import { WorkerController } from './presentation/controllers/worker.controller';
import { MetricsController } from './presentation/controllers/metrics.controller';

// Presentation — Gateway
import { EventsGateway } from './presentation/gateways/events.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    ProjectModule,
    QueueModule,
    JobModule,
    WorkerModule,
    SchedulerModule,
  ],
  controllers: [
    AuthController,
    OrganizationController,
    ProjectController,
    QueueController,
    JobController,
    DLQController,
    WorkerController,
    MetricsController,
  ],
  providers: [EventsGateway],
})
export class AppModule {}
