export enum WorkerStatus {
  ONLINE = 'ONLINE',
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  DRAINING = 'DRAINING',
  OFFLINE = 'OFFLINE',
}

export class WorkerEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public hostname: string,
    public pid: number,
    public queues: string[],
    public status: WorkerStatus,
    public concurrency: number,
    public lastHeartbeat: Date,
    public readonly startedAt: Date,
    public stoppedAt: Date | null,
    public metadata: Record<string, any>,
  ) {}

  isAlive(thresholdMs = 30000): boolean {
    return Date.now() - this.lastHeartbeat.getTime() < thresholdMs;
  }

  updateHeartbeat(): void {
    this.lastHeartbeat = new Date();
  }

  markOffline(): void {
    this.status = WorkerStatus.OFFLINE;
    this.stoppedAt = new Date();
  }
}
