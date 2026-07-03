export enum QueueStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export class QueueEntity {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public name: string,
    public description: string | null,
    public status: QueueStatus,
    public priority: number,
    public maxConcurrency: number,
    public rateLimitCount: number | null,
    public rateLimitWindow: number | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  pause(): void {
    this.status = QueueStatus.PAUSED;
    this.updatedAt = new Date();
  }

  resume(): void {
    this.status = QueueStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  archive(): void {
    this.status = QueueStatus.ARCHIVED;
    this.updatedAt = new Date();
  }

  isActive(): boolean {
    return this.status === QueueStatus.ACTIVE;
  }
}
