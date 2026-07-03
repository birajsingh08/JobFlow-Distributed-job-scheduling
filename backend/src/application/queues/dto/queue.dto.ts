import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsEnum,
  MaxLength,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum RetryStrategy {
  FIXED = 'FIXED',
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
}

export class RetryPolicyDto {
  @ApiPropertyOptional({ default: 3 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  maxRetries?: number;

  @ApiPropertyOptional({ enum: RetryStrategy, default: RetryStrategy.EXPONENTIAL })
  @IsEnum(RetryStrategy)
  @IsOptional()
  strategy?: RetryStrategy;

  @ApiPropertyOptional({ default: 1000 })
  @IsInt()
  @Min(100)
  @IsOptional()
  initialDelay?: number;

  @ApiPropertyOptional({ default: 30000 })
  @IsInt()
  @Min(1000)
  @IsOptional()
  maxDelay?: number;

  @ApiPropertyOptional({ default: 2.0 })
  @IsNumber()
  @Min(1.0)
  @IsOptional()
  backoffMultiple?: number;
}

export class CreateQueueDto {
  @ApiProperty({ example: 'email-sender' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxConcurrency?: number;

  @ApiPropertyOptional({ description: 'Rate limit: max jobs per window' })
  @IsInt()
  @Min(1)
  @IsOptional()
  rateLimitCount?: number;

  @ApiPropertyOptional({ description: 'Rate limit window in milliseconds' })
  @IsInt()
  @Min(1000)
  @IsOptional()
  rateLimitWindow?: number;

  @ApiPropertyOptional({ type: RetryPolicyDto })
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  @IsOptional()
  retryPolicy?: RetryPolicyDto;
}

export class UpdateQueueDto extends PartialType(CreateQueueDto) {}
