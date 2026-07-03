import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { QueueService } from '../../application/queues/queue.service';
import { CreateQueueDto, UpdateQueueDto } from '../../application/queues/dto/queue.dto';

@ApiTags('Queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new queue in project' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateQueueDto) {
    return this.queueService.createQueue(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all queues in project' })
  findAll(@Param('projectId') projectId: string) {
    return this.queueService.getQueues(projectId);
  }

  @Get(':queueId')
  @ApiOperation({ summary: 'Get queue details' })
  findOne(@Param('queueId') queueId: string) {
    return this.queueService.getQueue(queueId);
  }

  @Put(':queueId')
  @ApiOperation({ summary: 'Update queue configuration' })
  update(@Param('queueId') queueId: string, @Body() dto: UpdateQueueDto) {
    return this.queueService.updateQueue(queueId, dto);
  }

  @Delete(':queueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete queue' })
  remove(@Param('queueId') queueId: string) {
    return this.queueService.deleteQueue(queueId);
  }

  @Post(':queueId/pause')
  @ApiOperation({ summary: 'Pause queue' })
  pause(@Param('queueId') queueId: string) {
    return this.queueService.pauseQueue(queueId);
  }

  @Post(':queueId/resume')
  @ApiOperation({ summary: 'Resume paused queue' })
  resume(@Param('queueId') queueId: string) {
    return this.queueService.resumeQueue(queueId);
  }

  @Get(':queueId/stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  stats(@Param('queueId') queueId: string) {
    return this.queueService.getQueueStats(queueId);
  }
}
