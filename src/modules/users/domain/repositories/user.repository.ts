import { UserEntity } from '../entities/user.entity';

export interface UserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findByPublicUuid(publicUuid: string): Promise<UserEntity | null>;
  findById(id: number): Promise<UserEntity | null>;
  save(user: Partial<UserEntity>): Promise<UserEntity>;
}
