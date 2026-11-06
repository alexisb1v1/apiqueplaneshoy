import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { GetWeekendEventsQuery } from '../impl/get-weekend-events.query';
import { HomeEventCardResponseDto } from '../../dto/home-event-card.response.dto';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS, REDIS_DEFAULT_TTL } from '@modules/redis/redis.constants';
import { mapEventToHomeCard } from '../../utils/home-event-card.mapper';

@QueryHandler(GetWeekendEventsQuery)
export class GetWeekendEventsHandler implements IQueryHandler<GetWeekendEventsQuery> {
  private readonly logger = new Logger(GetWeekendEventsHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly redisService: RedisService,
  ) {}

  async execute(query: GetWeekendEventsQuery): Promise<HomeEventCardResponseDto[]> {
    const maxLimit = query.limit || 8;

    // 1. Verificar Caché en Memoria (Redis: qph:home:weekend)
    if (!query.skipCache) {
      const cached = await this.redisService.get<HomeEventCardResponseDto[]>(
        REDIS_CACHE_KEYS.HOME.WEEKEND,
      );
      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.logger.debug(`[Redis Cache HIT] Planes de fin de semana desde [${REDIS_CACHE_KEYS.HOME.WEEKEND}].`);
        return cached;
      }
      this.logger.debug(`[Redis Cache MISS] No hay caché en [${REDIS_CACHE_KEYS.HOME.WEEKEND}]. Consultando PostgreSQL...`);
    }

    // 2. Calcular ventana del fin de semana (Viernes 12:00 PM a Domingo 23:59:59)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 5 = Viernes, 6 = Sábado

    let fridayDate = new Date(now);
    if (currentDay === 5) {
      // Hoy es viernes
      fridayDate.setHours(0, 0, 0, 0);
    } else if (currentDay === 6) {
      // Hoy es sábado -> el viernes fue ayer
      fridayDate.setDate(now.getDate() - 1);
      fridayDate.setHours(0, 0, 0, 0);
    } else if (currentDay === 0) {
      // Hoy es domingo -> el viernes fue hace 2 días
      fridayDate.setDate(now.getDate() - 2);
      fridayDate.setHours(0, 0, 0, 0);
    } else {
      // Lunes a Jueves: calcular el próximo viernes
      const daysUntilFriday = (5 - currentDay + 7) % 7;
      fridayDate.setDate(now.getDate() + daysUntilFriday);
      fridayDate.setHours(12, 0, 0, 0);
    }

    const sundayDate = new Date(fridayDate);
    sundayDate.setDate(fridayDate.getDate() + (currentDay === 6 ? 1 : currentDay === 0 ? 0 : 2));
    sundayDate.setHours(23, 59, 59, 999);

    // Consulta de eventos en la ventana del fin de semana
    const weekendEvents = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.shows', 'shows')
      .leftJoinAndSelect('event.images', 'images')
      .leftJoinAndSelect('event.zones', 'zones')
      .where('event.status = :status', { status: 'published' })
      .andWhere('shows.startTime BETWEEN :fridayDate AND :sundayDate', {
        fridayDate,
        sundayDate,
      })
      .orderBy('shows.startTime', 'ASC')
      .take(maxLimit)
      .getMany();

    const resultIds = new Set(weekendEvents.map((e) => e.id));
    let resultEvents: EventEntity[] = [...weekendEvents];

    // 3. Fallback inteligente: si hay menos de maxLimit, rellenar con eventos de los próximos 14 días
    if (resultEvents.length < maxLimit) {
      const needed = maxLimit - resultEvents.length;
      const excludeIds = Array.from(resultIds);
      const in14Days = new Date(now);
      in14Days.setDate(in14Days.getDate() + 14);

      const qb = this.eventRepository
        .createQueryBuilder('event')
        .innerJoinAndSelect('event.shows', 'shows')
        .leftJoinAndSelect('event.images', 'images')
        .leftJoinAndSelect('event.zones', 'zones')
        .where('event.status = :status', { status: 'published' })
        .andWhere('shows.startTime >= :now', { now })
        .andWhere('shows.startTime <= :in14Days', { in14Days });

      if (excludeIds.length > 0) {
        qb.andWhere('event.id NOT IN (:...excludeIds)', { excludeIds });
      }

      const upcomingFill = await qb
        .orderBy('shows.startTime', 'ASC')
        .take(needed)
        .getMany();

      for (const ev of upcomingFill) {
        if (!resultIds.has(ev.id)) {
          resultIds.add(ev.id);
          resultEvents.push(ev);
        }
      }
    }

    // 4. Fallback final: si aún faltan, completar con eventos publicados recientes
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

      const recentFill = await qb
        .orderBy('event.createdAt', 'DESC')
        .take(needed)
        .getMany();

      resultEvents = [...resultEvents, ...recentFill];
    }

    // 5. Mapear a DTOs
    const mapped = resultEvents.map((event) => mapEventToHomeCard(event));

    // 6. Guardar en Redis con TTL de 15 minutos (900 s)
    if (mapped.length > 0) {
      await this.redisService.set(
        REDIS_CACHE_KEYS.HOME.WEEKEND,
        mapped,
        REDIS_DEFAULT_TTL.HOME_SECTIONS_SECONDS,
      );
      this.logger.debug(`[Redis Cache SET] Guardados ${mapped.length} planes de fin de semana en [${REDIS_CACHE_KEYS.HOME.WEEKEND}] (TTL: 15m).`);
    }

    return mapped;
  }
}

