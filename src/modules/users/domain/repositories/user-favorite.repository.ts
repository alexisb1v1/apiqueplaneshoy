import { UserFavoriteEventEntity } from '../entities/user-favorite-event.entity';
import { EventEntity } from '@events/domain/entities/event.entity';

export interface UserFavoriteRepository {
  findFavorite(userId: number, eventId: string): Promise<UserFavoriteEventEntity | null>;
  isFavorite(userId: number, eventId: string): Promise<boolean>;
  toggleFavorite(userId: number, eventIdentifier: string): Promise<{ isFavorite: boolean; event: EventEntity } | null>;
  removeFavorite(userId: number, eventIdentifier: string): Promise<boolean>;
  getFavoriteIds(userId: number): Promise<{ ids: string[]; publicUuids: string[] }>;
  getFavoriteEvents(userId: number): Promise<UserFavoriteEventEntity[]>;
}

