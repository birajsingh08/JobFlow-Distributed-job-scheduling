import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
