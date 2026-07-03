import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
