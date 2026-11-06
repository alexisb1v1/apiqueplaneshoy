import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { GetFeaturedEventsQuery } from '../impl/get-featured-events.query';
import { FeaturedEventResponseDto } from '../../dto/featured-event.response.dto';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS, REDIS_DEFAULT_TTL } from '@modules/redis/redis.constants';
import { plainToInstance } from 'class-transformer';

@QueryHandler(GetFeaturedEventsQuery)
export class GetFeaturedEventsHandler implements IQueryHandler<GetFeaturedEventsQuery> {
  private readonly logger = new Logger(GetFeaturedEventsHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly redisService: RedisService,
  ) {}

  async execute(query: GetFeaturedEventsQuery): Promise<FeaturedEventResponseDto[]> {
    const maxLimit = query.limit || 5;

    // 1. Intentar obtener desde Redis Cache (TTL 12 horas) a menos que se fuerce skipCache
    if (!query.skipCache) {
      const cached = await this.redisService.get<FeaturedEventResponseDto[]>(
        REDIS_CACHE_KEYS.HOME.HERO,
      );

      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.logger.debug(`[Redis Cache HIT] Recuperados ${cached.length} eventos destacados desde memoria.`);
        return cached;
      }
      this.logger.debug('[Redis Cache MISS] No hay caché válida. Consultando PostgreSQL...');
    } else {
      this.logger.debug('[Redis Cache BYPASS] Forzada consulta fresca a PostgreSQL.');
    }

    // 2. Obtener eventos que tienen 'isFeatured = true' y status = 'published'
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

    let resultEvents: EventEntity[] = [...featuredEvents];

    // 3. Si hay menos de maxLimit, rellenar con eventos publicados recientes
    if (resultEvents.length < maxLimit) {
      const needed = maxLimit - resultEvents.length;
      const excludeIds = resultEvents.map((e) => e.id);

      const queryBuilder = this.eventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.images', 'images')
        .leftJoinAndSelect('event.shows', 'shows')
        .leftJoinAndSelect('event.zones', 'zones')
        .where('event.status = :status', { status: 'published' });

      if (excludeIds.length > 0) {
        queryBuilder.andWhere('event.id NOT IN (:...excludeIds)', { excludeIds });
      }

      const fillEvents = await queryBuilder
        .orderBy('event.createdAt', 'DESC')
        .take(needed)
        .getMany();

      resultEvents = [...resultEvents, ...fillEvents];
    }

    // 4. Mapear a FeaturedEventResponseDto garantizando tipos estrictos
    const mappedResults = resultEvents.map((event) => {
      const banner = event.images?.find((img) => img.imageType === 'banner') || event.images?.[0];
      const prices = (event.zones || []).map((z) => Number(z.regularPrice)).filter((p) => !isNaN(p) && p >= 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const firstShow = (event.shows || []).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      )[0];
      const date = firstShow?.startTime
        ? new Date(firstShow.startTime).toISOString()
        : (event.createdAt ? event.createdAt.toISOString() : null);

      return plainToInstance(
        FeaturedEventResponseDto,
        {
          id: event.id.toString(),
          publicUuid: event.publicUuid,
          slug: event.slug,
          title: event.name,
          category: event.category,
          description: event.description,
          venue: event.venue,
          bannerUrl: banner?.imageUrl || null,
          date,
          minPrice,
          hasLandingPage: event.hasLandingPage,
          isFeatured: event.isFeatured,
        },
        { excludeExtraneousValues: true },
      );
    });

    // 5. Almacenar en Redis con TTL de 12 horas (43,200 segundos) en la carpeta qph:home:hero
    if (mappedResults.length > 0) {
      await this.redisService.set(
        REDIS_CACHE_KEYS.HOME.HERO,
        mappedResults,
        REDIS_DEFAULT_TTL.FEATURED_EVENTS_SECONDS,
      );
      this.logger.debug(`[Redis Cache SET] Guardados ${mappedResults.length} eventos destacados en [${REDIS_CACHE_KEYS.HOME.HERO}] con TTL de 12 horas.`);
    }

    return mappedResults;
  }
}

