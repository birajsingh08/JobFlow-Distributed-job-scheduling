import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  queue: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  job: {
    groupBy: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  jobExecution: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  queueMetric: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
};

const mockEvents = { emit: jest.fn() };

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    jest.clearAllMocks();
  });

  describe('createQueue', () => {
    it('should create a queue successfully', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue(null);
      mockPrisma.queue.create.mockResolvedValue({
        id: 'q-1',
        projectId: 'p-1',
        name: 'test-queue',
        status: 'ACTIVE',
        priority: 5,
        maxConcurrency: 5,
        retryPolicy: null,
      });

      const result = await service.createQueue('p-1', { name: 'test-queue' });
      expect(result.name).toBe('test-queue');
      expect(mockEvents.emit).toHaveBeenCalledWith('queue.created', expect.any(Object));
    });

    it('should throw ConflictException for duplicate queue name', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createQueue('p-1', { name: 'existing-queue' })).rejects.toThrow(
        'Queue "existing-queue" already exists',
      );
    });
  });

  describe('pauseQueue', () => {
    it('should pause an active queue', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({ id: 'q-1', status: 'ACTIVE', projectId: 'p-1' });
      mockPrisma.queue.update.mockResolvedValue({ id: 'q-1', status: 'PAUSED' });

      const result = await service.pauseQueue('q-1');
      expect(result.status).toBe('PAUSED');
      expect(mockEvents.emit).toHaveBeenCalledWith('queue.paused', expect.any(Object));
    });

    it('should throw BadRequestException if already paused', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({ id: 'q-1', status: 'PAUSED' });

      await expect(service.pauseQueue('q-1')).rejects.toThrow('Queue is already paused');
    });
  });

  describe('resumeQueue', () => {
    it('should resume a paused queue', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({ id: 'q-1', status: 'PAUSED', projectId: 'p-1' });
      mockPrisma.queue.update.mockResolvedValue({ id: 'q-1', status: 'ACTIVE' });

      const result = await service.resumeQueue('q-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('should throw if queue is not paused', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({ id: 'q-1', status: 'ACTIVE' });

      await expect(service.resumeQueue('q-1')).rejects.toThrow('Queue is not paused');
    });
  });
});
