import { UserEntity } from '../entities/user.entity';

export interface UserSearchFilters {
  role?: string;
  search?: string;
  isOrganizer?: boolean;
  page: number;
  limit: number;
}

export interface UserWithTicketsCount {
  user: UserEntity;
  ticketsCount: number;
}

export interface PaginatedUsersResult {
  items: UserWithTicketsCount[];
  total: number;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByPublicUuid(publicUuid: string): Promise<UserEntity | null>;
  findById(id: number): Promise<UserEntity | null>;
  save(user: Partial<UserEntity>): Promise<UserEntity>;
  findPaginated(filters: UserSearchFilters): Promise<PaginatedUsersResult>;
}
