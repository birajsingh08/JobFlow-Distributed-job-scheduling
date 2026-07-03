import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: Redis;

  // Lua script for atomic job claim (ZPOPMIN equivalent but with conditional)
  private readonly claimJobScript = `
    local queue_key = KEYS[1]
    local claimed_key = KEYS[2]
    local worker_id = ARGV[1]
    local now = ARGV[2]
    
    -- Get highest priority job (lowest score = highest priority)
    local result = redis.call('ZPOPMIN', queue_key)
    if #result == 0 then
      return nil
    end
    
    local job_id = result[1]
    local score = result[2]
    
    -- Mark as claimed with worker info
    redis.call('HSET', claimed_key, job_id, worker_id .. ':' .. now)
    
    return job_id
  `;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis(this.config.get('REDIS_URL', 'redis://localhost:6379'), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));

    await this.client.ping();
    this.logger.log('Redis connection established');
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  // ──────────────────────────────────
  // Queue Operations
  // ──────────────────────────────────

  async pushToQueue(queueId: string, jobId: string, priority: number): Promise<void> {
    const key = this.queueKey(queueId);
    // Lower score = higher priority (inverted: 100 - priority + timestamp fraction)
    const score = (100 - priority) * 1e9 + Date.now();
    await this.client.zadd(key, score, jobId);
  }

  async removeFromQueue(queueId: string, jobId: string): Promise<void> {
    await this.client.zrem(this.queueKey(queueId), jobId);
  }

  async claimNextJob(queueId: string, workerId: string): Promise<string | null> {
    const queueKey = this.queueKey(queueId);
    const claimedKey = this.claimedKey(queueId);

    const result = await this.client.eval(
      this.claimJobScript,
      2,
      queueKey,
      claimedKey,
      workerId,
      Date.now().toString(),
    ) as string | null;

    return result ?? null;
  }

  async releaseClaimedJob(queueId: string, jobId: string): Promise<void> {
    await this.client.hdel(this.claimedKey(queueId), jobId);
  }

  async requeueJob(queueId: string, jobId: string, priority: number, delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      await this.pushToQueue(queueId, jobId, priority);
      return;
    }
    // Store in a delayed sorted set by absolute time
    const runAt = Date.now() + delayMs;
    await this.client.zadd(this.delayedKey(queueId), runAt, jobId);
  }

  async getDelayedJobsDue(queueId: string): Promise<string[]> {
    const now = Date.now();
    const jobs = await this.client.zrangebyscore(this.delayedKey(queueId), 0, now);
    if (jobs.length > 0) {
      await this.client.zremrangebyscore(this.delayedKey(queueId), 0, now);
    }
    return jobs;
  }

  async getQueueLength(queueId: string): Promise<number> {
    return this.client.zcard(this.queueKey(queueId));
  }

  async getQueueInfo(queueId: string): Promise<{ pending: number; delayed: number }> {
    const [pending, delayed] = await Promise.all([
      this.client.zcard(this.queueKey(queueId)),
      this.client.zcard(this.delayedKey(queueId)),
    ]);
    return { pending, delayed };
  }

  // ──────────────────────────────────
  // Distributed Locks
  // ──────────────────────────────────

  async acquireLock(key: string, ttlMs: number, value: string): Promise<boolean> {
    const result = await this.client.set(`lock:${key}`, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string, value: string): Promise<boolean> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, `lock:${key}`, value);
    return result === 1;
  }

  async extendLock(key: string, ttlMs: number, value: string): Promise<boolean> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, `lock:${key}`, value, ttlMs.toString());
    return result === 1;
  }

  // ──────────────────────────────────
  // Rate Limiting
  // ──────────────────────────────────

  async isRateLimited(queueId: string, maxCount: number, windowMs: number): Promise<boolean> {
    const key = `ratelimit:${queueId}`;
    const pipeline = this.client.pipeline();
    pipeline.incr(key);
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();
    const count = results?.[0]?.[1] as number;
    return count > maxCount;
  }

  // ──────────────────────────────────
  // Worker Heartbeat
  // ──────────────────────────────────

  async setWorkerHeartbeat(workerId: string, data: Record<string, any>): Promise<void> {
    const key = `worker:${workerId}:heartbeat`;
    await this.client.setex(key, 60, JSON.stringify(data));
  }

  async getWorkerHeartbeat(workerId: string): Promise<Record<string, any> | null> {
    const key = `worker:${workerId}:heartbeat`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getActiveWorkerIds(): Promise<string[]> {
    const keys = await this.client.keys('worker:*:heartbeat');
    return keys.map((k) => k.split(':')[1]);
  }

  // ──────────────────────────────────
  // Pub/Sub helper
  // ──────────────────────────────────

  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  // ──────────────────────────────────
  // Keys
  // ──────────────────────────────────

  private queueKey(queueId: string): string {
    return `queue:${queueId}:pending`;
  }

  private claimedKey(queueId: string): string {
    return `queue:${queueId}:claimed`;
  }

  private delayedKey(queueId: string): string {
    return `queue:${queueId}:delayed`;
  }
}
