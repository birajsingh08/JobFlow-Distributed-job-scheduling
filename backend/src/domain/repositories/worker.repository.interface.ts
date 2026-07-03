import { WorkerEntity } from '../entities/worker.entity';

export abstract class IWorkerRepository {
  abstract findById(id: string): Promise<WorkerEntity | null>;
  abstract findAll(): Promise<WorkerEntity[]>;
  abstract findActive(): Promise<WorkerEntity[]>;
  abstract save(worker: WorkerEntity): Promise<WorkerEntity>;
  abstract update(id: string, data: Partial<WorkerEntity>): Promise<WorkerEntity>;
  abstract markDeadWorkers(before: Date): Promise<string[]>;
  abstract delete(id: string): Promise<void>;
}
