import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from './job.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  job: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  queue: {
    findUnique: jest.fn(),
  },
  jobLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  deadLetterQueue: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
};

const mockRedis = {
  pushToQueue: jest.fn().mockResolvedValue(undefined),
  removeFromQueue: jest.fn().mockResolvedValue(undefined),
  claimNextJob: jest.fn().mockResolvedValue(null),
};

const mockEvents = { emit: jest.fn() };

describe('JobService', () => {
  let service: JobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('should create an immediate job and push to redis', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({
        id: 'q-1',
        status: 'ACTIVE',
        projectId: 'p-1',
        retryPolicy: { maxRetries: 3 },
      });
      mockPrisma.job.create.mockResolvedValue({
        id: 'job-1',
        queueId: 'q-1',
        name: 'test-job',
        status: 'QUEUED',
        type: 'IMMEDIATE',
        priority: 5,
      });

      const result = await service.createJob('q-1', { name: 'test-job' });

      expect(result.job.status).toBe('QUEUED');
      expect(mockRedis.pushToQueue).toHaveBeenCalledWith('q-1', 'job-1', 5);
      expect(mockEvents.emit).toHaveBeenCalledWith('job.created', expect.any(Object));
    });

    it('should not push delayed job to redis immediately', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({
        id: 'q-1',
        status: 'ACTIVE',
        projectId: 'p-1',
        retryPolicy: null,
      });
      mockPrisma.job.create.mockResolvedValue({
        id: 'job-2',
        status: 'SCHEDULED',
        type: 'DELAYED',
        priority: 5,
      });

      await service.createJob('q-1', { name: 'delayed-job', type: 'DELAYED' as any, runAt: new Date(Date.now() + 60000).toISOString() });

      expect(mockRedis.pushToQueue).not.toHaveBeenCalled();
    });

    it('should throw if queue is paused', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({ status: 'PAUSED' });

      await expect(
        service.createJob('q-1', { name: 'test' }),
      ).rejects.toThrow('Queue is paused');
    });

    it('should return existing job for duplicate idempotency key', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({ status: 'ACTIVE', projectId: 'p-1', retryPolicy: null });
      const existingJob = { id: 'existing-job', name: 'test' };
      mockPrisma.job.findUnique.mockResolvedValue(existingJob);

      const result = await service.createJob('q-1', { name: 'test', idempotencyKey: 'my-key-123' });

      expect(result.idempotent).toBe(true);
      expect(result.job).toBe(existingJob);
      expect(mockPrisma.job.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelJob', () => {
    it('should cancel a queued job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'QUEUED',
        queueId: 'q-1',
        queue: { projectId: 'p-1' },
      });
      mockPrisma.job.update.mockResolvedValue({ id: 'job-1', status: 'CANCELLED' });

      const result = await service.cancelJob('job-1', 'No longer needed');

      expect(result.status).toBe('CANCELLED');
      expect(mockRedis.removeFromQueue).toHaveBeenCalledWith('q-1', 'job-1');
    });

    it('should throw when cancelling a completed job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
        queue: {},
      });

      await expect(service.cancelJob('job-1')).rejects.toThrow('terminal state');
    });
  });

  describe('retryJob', () => {
    it('should requeue a failed job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'FAILED',
        queueId: 'q-1',
        priority: 5,
        queue: { projectId: 'p-1' },
        payload: { test: true },
      });
      mockPrisma.job.update.mockResolvedValue({ id: 'job-1', status: 'QUEUED' });

      await service.retryJob('job-1');

      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'QUEUED', retryCount: 0 }) }),
      );
      expect(mockRedis.pushToQueue).toHaveBeenCalled();
    });

    it('should throw if job is not in failed state', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({ id: 'job-1', status: 'RUNNING', queue: {} });

      await expect(service.retryJob('job-1')).rejects.toThrow('Only FAILED');
    });
  });
});
