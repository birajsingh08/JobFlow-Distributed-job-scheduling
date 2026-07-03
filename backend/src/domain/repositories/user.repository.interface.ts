import { UserEntity } from '../entities/user.entity';

export abstract class IUserRepository {
  abstract findById(id: string): Promise<UserEntity | null>;
  abstract findByEmail(email: string): Promise<UserEntity | null>;
  abstract save(user: UserEntity): Promise<UserEntity>;
  abstract update(id: string, data: Partial<UserEntity>): Promise<UserEntity>;
  abstract delete(id: string): Promise<void>;
  abstract findAll(page: number, limit: number): Promise<{ users: UserEntity[]; total: number }>;
}
