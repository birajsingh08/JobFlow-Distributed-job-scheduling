export enum JobStatus {
  QUEUED = 'QUEUED',
  SCHEDULED = 'SCHEDULED',
  CLAIMED = 'CLAIMED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
  DEAD = 'DEAD',
}

export enum JobType {
  IMMEDIATE = 'IMMEDIATE',
  DELAYED = 'DELAYED',
  CRON = 'CRON',
  RECURRING = 'RECURRING',
  BATCH = 'BATCH',
}

export class JobEntity {
  constructor(
    public readonly id: string,
    public readonly queueId: string,
    public name: string,
    public type: JobType,
    public status: JobStatus,
    public priority: number,
    public payload: Record<string, any>,
    public headers: Record<string, any>,
    public tags: string[],
    public cronExpression: string | null,
    public scheduledAt: Date | null,
    public runAt: Date | null,
    public startedAt: Date | null,
    public completedAt: Date | null,
    public failedAt: Date | null,
    public retryCount: number,
    public maxRetries: number,
    public timeout: number,
    public result: Record<string, any> | null,
    public errorMessage: string | null,
    public errorStack: string | null,
    public workerId: string | null,
    public batchId: string | null,
    public parentJobId: string | null,
    public idempotencyKey: string | null,
    public createdById: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  canRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }

  isTerminal(): boolean {
    return [JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.DEAD].includes(this.status);
  }

  markClaimed(workerId: string): void {
    this.status = JobStatus.CLAIMED;
    this.workerId = workerId;
    this.updatedAt = new Date();
  }

  markRunning(): void {
    this.status = JobStatus.RUNNING;
    this.startedAt = new Date();
    this.updatedAt = new Date();
  }

  markCompleted(result?: Record<string, any>): void {
    this.status = JobStatus.COMPLETED;
    this.completedAt = new Date();
    this.result = result ?? null;
    this.updatedAt = new Date();
  }

  markFailed(error: string, stack?: string): void {
    this.status = JobStatus.FAILED;
    this.failedAt = new Date();
    this.errorMessage = error;
    this.errorStack = stack ?? null;
    this.updatedAt = new Date();
  }

  markRetrying(): void {
    this.status = JobStatus.RETRYING;
    this.retryCount += 1;
    this.workerId = null;
    this.updatedAt = new Date();
  }

  markDead(): void {
    this.status = JobStatus.DEAD;
    this.updatedAt = new Date();
  }

  markCancelled(): void {
    this.status = JobStatus.CANCELLED;
    this.updatedAt = new Date();
  }
}
