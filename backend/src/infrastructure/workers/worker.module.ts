import { Module } from '@nestjs/common';
import { WorkerEngine } from './worker.engine';
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [WorkerEngine],
  exports: [WorkerEngine],
})
export class WorkerModule {}
