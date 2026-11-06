import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { GetWeeklyFeaturedEventsQuery } from '../impl/get-weekly-featured-events.query';
import { HomeEventCardResponseDto } from '../../dto/home-event-card.response.dto';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS, REDIS_DEFAULT_TTL } from '@modules/redis/redis.constants';
import { mapEventToHomeCard } from '../../utils/home-event-card.mapper';

@QueryHandler(GetWeeklyFeaturedEventsQuery)
export class GetWeeklyFeaturedEventsHandler implements IQueryHandler<GetWeeklyFeaturedEventsQuery> {
  private readonly logger = new Logger(GetWeeklyFeaturedEventsHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly redisService: RedisService,
  ) {}

  async execute(query: GetWeeklyFeaturedEventsQuery): Promise<HomeEventCardResponseDto[]> {
    const maxLimit = query.limit || 8;

    // 1. Verificar Caché en Memoria (Redis: qph:home:weekly_featured)
    if (!query.skipCache) {
      const cached = await this.redisService.get<HomeEventCardResponseDto[]>(
        REDIS_CACHE_KEYS.HOME.WEEKLY_FEATURED,
      );
      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.logger.debug(`[Redis Cache HIT] Eventos destacados semanales desde [${REDIS_CACHE_KEYS.HOME.WEEKLY_FEATURED}].`);
        return cached;
      }
      this.logger.debug(`[Redis Cache MISS] No hay caché en [${REDIS_CACHE_KEYS.HOME.WEEKLY_FEATURED}]. Consultando PostgreSQL...`);
    }

    // 2. Prioridad A: Eventos marcados como destacados por administración (isFeatured = true)
    const featuredEvents = await this.eventRepository.find({
      where: {
        status: 'published',
        isFeatured: true,
      },
      relations: {
        images: true,
        shows: true,
        zones: true,
      },
      order: { createdAt: 'DESC' },
      take: maxLimit,
    });

    const resultIds = new Set(featuredEvents.map((e) => e.id));
    let resultEvents: EventEntity[] = [...featuredEvents];

    // Prioridad B: Si faltan cupos, completar con eventos publicados con funciones en los próximos 30 días
    if (resultEvents.length < maxLimit) {
      const needed = maxLimit - resultEvents.length;
      const excludeIds = Array.from(resultIds);
      const now = new Date();
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);

      const qb = this.eventRepository
        .createQueryBuilder('event')
        .innerJoinAndSelect('event.shows', 'shows')
        .leftJoinAndSelect('event.images', 'images')
        .leftJoinAndSelect('event.zones', 'zones')
        .where('event.status = :status', { status: 'published' })
        .andWhere('shows.startTime BETWEEN :now AND :in30Days', { now, in30Days });

      if (excludeIds.length > 0) {
        qb.andWhere('event.id NOT IN (:...excludeIds)', { excludeIds });
      }

      const activeEvents = await qb
        .orderBy('shows.startTime', 'ASC')
        .take(needed)
        .getMany();

      for (const ev of activeEvents) {
        if (!resultIds.has(ev.id)) {
          resultIds.add(ev.id);
          resultEvents.push(ev);
        }
      }
    }

    // Prioridad C: Fallback con eventos publicados recientes si aún faltan
    if (resultEvents.length < maxLimit) {
      const needed = maxLimit - resultEvents.length;
      const excludeIds = Array.from(resultIds);

      const qb = this.eventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.shows', 'shows')
        .leftJoinAndSelect('event.images', 'images')
        .leftJoinAndSelect('event.zones', 'zones')
        .where('event.status = :status', { status: 'published' });

      if (excludeIds.length > 0) {
        qb.andWhere('event.id NOT IN (:...excludeIds)', { excludeIds });
      }

      const fallbackEvents = await qb
        .orderBy('event.createdAt', 'DESC')
        .take(needed)
        .getMany();

      resultEvents = [...resultEvents, ...fallbackEvents];
    }

    // 3. Mapear a DTOs
    const mapped = resultEvents.map((event) => mapEventToHomeCard(event));

    // 4. Guardar en Redis con TTL de 15 minutos (900 s)
    if (mapped.length > 0) {
      await this.redisService.set(
        REDIS_CACHE_KEYS.HOME.WEEKLY_FEATURED,
        mapped,
        REDIS_DEFAULT_TTL.HOME_SECTIONS_SECONDS,
      );
      this.logger.debug(`[Redis Cache SET] Guardados ${mapped.length} destacados semanales en [${REDIS_CACHE_KEYS.HOME.WEEKLY_FEATURED}] (TTL: 15m).`);
    }

    return mapped;
  }
}

