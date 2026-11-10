import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { GetEventDetailQuery } from '../impl/get-event-detail.query';
import { EventDetailResponseDto } from '../../dto/event-detail.response.dto';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS, REDIS_DEFAULT_TTL } from '@modules/redis/redis.constants';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { plainToInstance } from 'class-transformer';

@QueryHandler(GetEventDetailQuery)
export class GetEventDetailHandler implements IQueryHandler<GetEventDetailQuery> {
  private readonly logger = new Logger(GetEventDetailHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly redisService: RedisService,
  ) {}

  async execute(query: GetEventDetailQuery): Promise<EventDetailResponseDto> {
    const cacheKey = REDIS_CACHE_KEYS.EVENTS.DETAIL(query.identifier);

    // 1. Verificar Caché en Redis
    if (!query.skipCache) {
      const cached = await this.redisService.get<EventDetailResponseDto>(cacheKey);
      if (cached && cached.coordinates !== undefined && cached.zoneMapUrl !== undefined) {
        this.logger.debug(`[Redis Cache HIT] Detalle de evento [${query.identifier}] recuperado desde memoria.`);
        return cached;
      }
      this.logger.debug(`[Redis Cache MISS / Obsoleto] Consultando PostgreSQL para detalle [${query.identifier}]...`);
    }

    // 2. Determinar criterio de búsqueda (ID numérico, publicUuid o slug)
    const isNumeric = /^\d+$/.test(query.identifier);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.identifier);

    let whereClause: Record<string, any>;
    if (isNumeric) {
      whereClause = { id: parseInt(query.identifier, 10), status: 'published' };
    } else if (isUuid) {
      whereClause = { publicUuid: query.identifier, status: 'published' };
    } else {
      whereClause = { slug: query.identifier, status: 'published' };
    }

    // 3. Consultar evento en PostgreSQL
    const event = await this.eventRepository.findOne({
      where: whereClause,
      relations: {
        images: true,
        shows: true,
        zones: {
          pricingTiers: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Evento '${query.identifier}' no encontrado o no se encuentra publicado.`);
    }

    // 4. Resolver Ciudad, Banner y Mapa de Zonas
    const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);
    const city = (cityInfo.name && cityInfo.name !== 'Perú' ? cityInfo.name : event.venue || 'LIMA').toUpperCase();
    const banner = event.images?.find((img) => img.imageType === 'banner') || event.images?.[0];
    const zoneMapImage = event.images?.find((img) => img.imageType === 'zone_map');
    const zoneMapUrl =
      zoneMapImage?.imageUrl ||
      event.landingConfig?.body?.bodyImageUrl ||
      event.landingConfig?.zoneMapUrl ||
      null;

    // 5. Mapear Zonas y Precios Dinámicos (Preventas en Cascada)
    const now = new Date();
    const mappedZones = (event.zones || []).map((zone) => {
      const activeTiers = (zone.pricingTiers || [])
        .filter((tier) => tier.isActive && (!tier.endAt || new Date(tier.endAt) >= now) && Number(tier.soldCount) < Number(tier.capacity))
        .sort((a, b) => a.tierNumber - b.tierNumber);

      const currentTier = activeTiers[0];
      const currentPrice = currentTier ? Number(currentTier.price) : Number(zone.regularPrice);
      const activeTierName = currentTier ? currentTier.name : 'Venta Regular';

      const cap = Number(zone.capacity) || 0;
      const sold = Number(zone.soldCount) || 0;
      const locked = Number(zone.lockedCount) || 0;
      const remainingTickets = Math.max(0, cap - sold - locked);

      return {
        id: zone.id.toString(),
        publicUuid: zone.publicUuid,
        name: zone.name,
        title: zone.title,
        color: zone.color || '#4F46E5',
        benefits: zone.benefits,
        regularPrice: Number(zone.regularPrice),
        currentPrice,
        activeTierName,
        capacity: cap,
        remainingTickets,
        isSoldOut: remainingTickets <= 0,
        maxTicketsPerOrder: zone.maxTicketsPerOrder || 4,
      };
    });

    // 6. Mapear Funciones
    const mappedShows = (event.shows || []).map((show) => ({
      id: show.id.toString(),
      publicUuid: show.publicUuid,
      name: show.name,
      startTime: new Date(show.startTime).toISOString(),
      durationHours: show.durationHours || 2,
    }));

    // 7. Construir DTO de respuesta
    const responseDto = plainToInstance(
      EventDetailResponseDto,
      {
        id: event.id.toString(),
        publicUuid: event.publicUuid,
        slug: event.slug,
        name: event.name,
        category: event.category,
        description: event.description,
        venue: event.venue,
        address: event.address,
        city,
        hasLandingPage: event.hasLandingPage,
        bannerUrl: banner?.imageUrl || null,
        zoneMapUrl,
        termsAndConditionsUrl: event.termsAndConditionsUrl,
        ageRestriction: event.ageRestriction,
        userTicketLimit: event.userTicketLimit || 6,
        openingHoursComment: event.openingHoursComment,
        entryRequirements: event.entryRequirements,
        googleMapsUrl: event.googleMapsUrl,
        coordinates: event.coordinates || null,
        addressReference: event.addressReference || null,
        shows: mappedShows,
        zones: mappedZones,
      },
      { excludeExtraneousValues: true },
    );

    // 8. Guardar en Redis con TTL de 15 minutos
    await this.redisService.set(cacheKey, responseDto, REDIS_DEFAULT_TTL.EVENT_DETAIL_SECONDS);
    this.logger.debug(`[Redis Cache SET] Detalle de evento guardado en [${cacheKey}] con TTL de 15 minutos.`);

    return responseDto;
  }
}

