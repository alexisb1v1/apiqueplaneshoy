import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFavoriteEventEntity } from '../../domain/entities/user-favorite-event.entity';
import { UserFavoriteRepository } from '../../domain/repositories/user-favorite.repository';
import { EventEntity } from '@events/domain/entities/event.entity';

@Injectable()
export class TypeormUserFavoriteRepository implements UserFavoriteRepository {
  private readonly logger = new Logger(TypeormUserFavoriteRepository.name);

  constructor(
    @InjectRepository(UserFavoriteEventEntity)
    private readonly favoriteRepo: Repository<UserFavoriteEventEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
  ) {}

  /**
   * Resuelve la entidad EventEntity buscando por ID numérico, publicUuid o slug
   */
  private async resolveEvent(identifier: string): Promise<EventEntity | null> {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const byId = await this.eventRepo.findOne({ where: { id: trimmed } });
      if (byId) return byId;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmed)) {
      const byUuid = await this.eventRepo.findOne({ where: { publicUuid: trimmed } });
      if (byUuid) return byUuid;
    }

    return this.eventRepo.findOne({ where: { slug: trimmed } });
  }

  async findFavorite(userId: number, eventId: string): Promise<UserFavoriteEventEntity | null> {
    return this.favoriteRepo.findOne({
      where: { userId, eventId },
    });
  }

  async isFavorite(userId: number, eventId: string): Promise<boolean> {
    const count = await this.favoriteRepo.count({
      where: { userId, eventId },
    });
    return count > 0;
  }

  /**
   * Alterna el estado de favorito (si existe lo borra, si no existe lo crea)
   */
  async toggleFavorite(
    userId: number,
    eventIdentifier: string,
  ): Promise<{ isFavorite: boolean; event: EventEntity } | null> {
    const event = await this.resolveEvent(eventIdentifier);
    if (!event) return null;

    const existing = await this.favoriteRepo.findOne({
      where: { userId, eventId: event.id },
    });

    if (existing) {
      await this.favoriteRepo.delete({ id: existing.id });
      return { isFavorite: false, event };
    }

    const newFav = this.favoriteRepo.create({
      userId,
      eventId: event.id,
    });
    await this.favoriteRepo.save(newFav);

    return { isFavorite: true, event };
  }

  /**
   * Elimina un evento de favoritos
   */
  async removeFavorite(userId: number, eventIdentifier: string): Promise<boolean> {
    const event = await this.resolveEvent(eventIdentifier);
    if (!event) return false;

    const result = await this.favoriteRepo.delete({
      userId,
      eventId: event.id,
    });

    return (result.affected || 0) > 0;
  }

  /**
   * Obtiene todos los IDs y publicUuids de los eventos favoritos de un usuario
   */
  async getFavoriteIds(userId: number): Promise<{ ids: string[]; publicUuids: string[] }> {
    const favorites = await this.favoriteRepo.find({
      where: { userId },
      relations: {
        event: true,
      },
      select: {
        id: true,
        eventId: true,
        event: {
          id: true,
          publicUuid: true,
        },
      },
    });

    const ids: string[] = [];
    const publicUuids: string[] = [];

    for (const fav of favorites) {
      if (fav.eventId) ids.push(fav.eventId);
      if (fav.event?.publicUuid) publicUuids.push(fav.event.publicUuid);
    }

    return { ids, publicUuids };
  }

  /**
   * Obtiene los eventos favoritos completos de un usuario con relaciones para renderizar en la pestaña
   */
  async getFavoriteEvents(userId: number): Promise<UserFavoriteEventEntity[]> {
    return this.favoriteRepo.find({
      where: { userId },
      relations: {
        event: {
          images: true,
          shows: true,
          zones: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }
}
