import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JobService } from '../../application/jobs/job.service';
import {
  CreateJobDto,
  BulkCreateJobDto,
  RetryJobDto,
  CancelJobDto,
  JobQueryDto,
} from '../../application/jobs/dto/job.dto';

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('queues/:queueId/jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a job to queue' })
  create(@Param('queueId') queueId: string, @Body() dto: CreateJobDto, @Request() req: any) {
    return this.jobService.createJob(queueId, dto, req.user.id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Submit multiple jobs as a batch' })
  createBulk(@Param('queueId') queueId: string, @Body() dto: BulkCreateJobDto, @Request() req: any) {
    return this.jobService.createBulkJobs(queueId, dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs in queue' })
  findAll(@Param('queueId') queueId: string, @Query() query: JobQueryDto) {
    return this.jobService.getJobs(queueId, query);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get job details' })
  findOne(@Param('jobId') jobId: string) {
    return this.jobService.getJob(jobId);
  }

  @Post(':jobId/retry')
  @ApiOperation({ summary: 'Retry a failed job' })
  retry(@Param('jobId') jobId: string, @Body() dto: RetryJobDto) {
    return this.jobService.retryJob(jobId, dto);
  }

  @Post(':jobId/cancel')
  @ApiOperation({ summary: 'Cancel a job' })
  cancel(@Param('jobId') jobId: string, @Body() dto: CancelJobDto) {
    return this.jobService.cancelJob(jobId, dto.reason);
  }

  @Get(':jobId/logs')
  @ApiOperation({ summary: 'Get job logs' })
  getLogs(
    @Param('jobId') jobId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.jobService.getJobLogs(jobId, page, limit);
  }
}

@ApiTags('Dead Letter Queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/dlq')
export class DLQController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  @ApiOperation({ summary: 'List dead letter queue entries' })
  findAll(
    @Param('projectId') projectId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.jobService.getDeadLetterQueue(projectId, page, limit);
  }

  @Post(':dlqId/requeue')
  @ApiOperation({ summary: 'Requeue a dead letter job' })
  requeue(@Param('dlqId') dlqId: string) {
    return this.jobService.requeueDeadLetterJob(dlqId);
  }
}
