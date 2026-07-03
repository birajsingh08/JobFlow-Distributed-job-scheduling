import { JobEntity, JobStatus } from '../entities/job.entity';

export interface FindJobsFilter {
  queueId?: string;
  status?: JobStatus | JobStatus[];
  batchId?: string;
  workerId?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface PaginatedJobs {
  jobs: JobEntity[];
  total: number;
  page: number;
  limit: number;
}

export abstract class IJobRepository {
  abstract findById(id: string): Promise<JobEntity | null>;
  abstract findByIdempotencyKey(key: string): Promise<JobEntity | null>;
  abstract save(job: JobEntity): Promise<JobEntity>;
  abstract update(id: string, data: Partial<JobEntity>): Promise<JobEntity>;
  abstract delete(id: string): Promise<void>;
  abstract findMany(filter: FindJobsFilter, page: number, limit: number): Promise<PaginatedJobs>;
  abstract findRunnableJobs(queueIds: string[], limit: number): Promise<JobEntity[]>;
  abstract countByStatus(queueId: string): Promise<Record<JobStatus, number>>;
  abstract claimJob(jobId: string, workerId: string): Promise<JobEntity | null>;
  abstract releaseStaleJobs(workerIds: string[], before: Date): Promise<number>;
}
