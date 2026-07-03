import { QueueEntity } from '../entities/queue.entity';

export abstract class IQueueRepository {
  abstract findById(id: string): Promise<QueueEntity | null>;
  abstract findByProjectId(projectId: string): Promise<QueueEntity[]>;
  abstract findByProjectAndName(projectId: string, name: string): Promise<QueueEntity | null>;
  abstract save(queue: QueueEntity): Promise<QueueEntity>;
  abstract update(id: string, data: Partial<QueueEntity>): Promise<QueueEntity>;
  abstract delete(id: string): Promise<void>;
}
