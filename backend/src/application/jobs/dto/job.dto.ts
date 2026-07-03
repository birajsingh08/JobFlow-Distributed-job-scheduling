import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  IsObject,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum JobType {
  IMMEDIATE = 'IMMEDIATE',
  DELAYED = 'DELAYED',
  CRON = 'CRON',
  RECURRING = 'RECURRING',
  BATCH = 'BATCH',
}

export class CreateJobDto {
  @ApiProperty({ example: 'send-welcome-email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ enum: JobType, default: JobType.IMMEDIATE })
  @IsEnum(JobType)
  @IsOptional()
  type?: JobType;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ description: 'Job payload as JSON object' })
  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Custom headers' })
  @IsObject()
  @IsOptional()
  headers?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags for filtering', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Cron expression (for CRON type)', example: '0 9 * * *' })
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiPropertyOptional({ description: 'Run at this time (for DELAYED type)', type: String })
  @IsDateString()
  @IsOptional()
  runAt?: string;

  @ApiPropertyOptional({ default: 30000, description: 'Timeout in ms' })
  @IsInt()
  @Min(1000)
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  maxRetries?: number;

  @ApiPropertyOptional({ description: 'Idempotency key to prevent duplicates' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Batch ID for grouping jobs' })
  @IsString()
  @IsOptional()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Parent job ID for workflow dependencies' })
  @IsString()
  @IsOptional()
  parentJobId?: string;
}

export class BulkCreateJobDto {
  @ApiProperty({ type: [CreateJobDto] })
  @IsArray()
  jobs: CreateJobDto[];

  @ApiPropertyOptional({ description: 'Shared batch ID' })
  @IsString()
  @IsOptional()
  batchId?: string;
}

export class RetryJobDto {
  @ApiPropertyOptional({ description: 'Override payload on retry' })
  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}

export class CancelJobDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class JobQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'priority', 'status'] })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
