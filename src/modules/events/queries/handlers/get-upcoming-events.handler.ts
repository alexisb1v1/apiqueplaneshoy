import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { GetUpcomingEventsQuery } from '../impl/get-upcoming-events.query';
import { HomeEventCardResponseDto } from '../../dto/home-event-card.response.dto';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS, REDIS_DEFAULT_TTL } from '@modules/redis/redis.constants';
import { mapEventToHomeCard } from '../../utils/home-event-card.mapper';

@QueryHandler(GetUpcomingEventsQuery)
export class GetUpcomingEventsHandler implements IQueryHandler<GetUpcomingEventsQuery> {
  private readonly logger = new Logger(GetUpcomingEventsHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly redisService: RedisService,
  ) {}

  async execute(query: GetUpcomingEventsQuery): Promise<HomeEventCardResponseDto[]> {
    const maxLimit = query.limit || 8;

    // 1. Verificar Caché en Memoria (Redis: qph:home:upcoming)
    if (!query.skipCache) {
      const cached = await this.redisService.get<HomeEventCardResponseDto[]>(
        REDIS_CACHE_KEYS.HOME.UPCOMING,
      );
      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.logger.debug(`[Redis Cache HIT] Próximos eventos recuperados desde [${REDIS_CACHE_KEYS.HOME.UPCOMING}].`);
        return cached;
      }
      this.logger.debug(`[Redis Cache MISS] No hay caché en [${REDIS_CACHE_KEYS.HOME.UPCOMING}]. Consultando PostgreSQL...`);
    }

    // 2. Consultar eventos publicados con funciones cronológicas
    const now = new Date();

    // Prioridad: eventos con funciones a partir de ahora ordenadas cronológicamente
    const eventsWithFutureShows = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.shows', 'shows')
      .leftJoinAndSelect('event.images', 'images')
      .leftJoinAndSelect('event.zones', 'zones')
      .where('event.status = :status', { status: 'published' })
      .andWhere('shows.startTime >= :now', { now })
      .orderBy('shows.startTime', 'ASC')
      .take(maxLimit)
      .getMany();

    const resultIds = new Set(eventsWithFutureShows.map((e) => e.id));
    let resultEvents: EventEntity[] = [...eventsWithFutureShows];

    // Si hay menos del límite, rellenar con eventos publicados recientes
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

      const fillEvents = await qb
        .orderBy('event.createdAt', 'DESC')
        .take(needed)
        .getMany();

      resultEvents = [...resultEvents, ...fillEvents];
    }

    // 3. Mapear a DTO con cálculo de aforos, precios y badges
    const mapped = resultEvents.map((event) => mapEventToHomeCard(event));

    // 4. Guardar en Redis con TTL de 15 minutos (900 s)
    if (mapped.length > 0) {
      await this.redisService.set(
        REDIS_CACHE_KEYS.HOME.UPCOMING,
        mapped,
        REDIS_DEFAULT_TTL.HOME_SECTIONS_SECONDS,
      );
      this.logger.debug(`[Redis Cache SET] Guardados ${mapped.length} próximos eventos en [${REDIS_CACHE_KEYS.HOME.UPCOMING}] (TTL: 15m).`);
    }

    return mapped;
  }
}

