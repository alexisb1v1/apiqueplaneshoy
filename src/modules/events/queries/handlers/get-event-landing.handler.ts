import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { GetEventLandingQuery } from '../impl/get-event-landing.query';
import { EventLandingResponseDto } from '../../dto/event-landing.response.dto';
import { RedisService } from '@modules/redis/redis.service';
import {
  REDIS_CACHE_KEYS,
  REDIS_DEFAULT_TTL,
} from '@modules/redis/redis.constants';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { plainToInstance } from 'class-transformer';

@QueryHandler(GetEventLandingQuery)
export class GetEventLandingHandler implements IQueryHandler<GetEventLandingQuery> {
  private readonly logger = new Logger(GetEventLandingHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly redisService: RedisService,
  ) {}

  async execute(query: GetEventLandingQuery): Promise<EventLandingResponseDto> {
    const isPreviewMode = Boolean(query.previewTemp);
    const cacheKey = REDIS_CACHE_KEYS.EVENTS.LANDING(query.slug);

    // 1. Verificar Caché en Redis (Solo si NO es modo previewTemp ni skipCache)
    if (!query.skipCache && !isPreviewMode) {
      const cached =
        await this.redisService.get<EventLandingResponseDto>(cacheKey);
      if (cached) {
        this.logger.debug(
          `[Redis Cache HIT] Landing de evento [${query.slug}] recuperado desde memoria.`,
        );
        return cached;
      }
      this.logger.debug(
        `[Redis Cache MISS] No hay caché para landing [${query.slug}]. Consultando PostgreSQL...`,
      );
    }

    // 2. Consultar evento por slug (o publicUuid si tiene formato UUID).
    // Si previewTemp está presente, permite ver eventos no publicados (draft/pending)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        query.slug,
      );
    const baseWhere: Record<string, any> = isUuid
      ? { publicUuid: query.slug }
      : { slug: query.slug };

    if (!isPreviewMode) {
      baseWhere.status = 'published';
    }

    const event = await this.eventRepository.findOne({
      where: baseWhere,
      relations: {
        images: true,
        shows: true,
        zones: {
          pricingTiers: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Evento '${query.slug}' no encontrado.`);
    }

    if (!isPreviewMode && !event.hasLandingPage) {
      throw new NotFoundException(
        `Landing page para el evento con slug '${query.slug}' no encontrada o no está habilitada.`,
      );
    }

    // 3. Resolver Ciudad, Banner y Mapa de Zonas
    const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);
    const city = (
      cityInfo.name && cityInfo.name !== 'Perú'
        ? cityInfo.name
        : event.venue || 'LIMA'
    ).toUpperCase();
    const banner =
      event.images?.find((img) => img.imageType === 'banner') ||
      event.images?.[0];
    const zoneMapImg = event.images?.find(
      (img) => img.imageType === 'zone_map',
    );

    // 4. Mapear Zonas y Precios Dinámicos (Preventas en Cascada)
    const now = new Date();
    const mappedZones = (event.zones || []).map((zone) => {
      const activeTiers = (zone.pricingTiers || [])
        .filter(
          (tier) =>
            tier.isActive &&
            (!tier.endAt || new Date(tier.endAt) >= now) &&
            Number(tier.soldCount) < Number(tier.capacity),
        )
        .sort((a, b) => a.tierNumber - b.tierNumber);

      const currentTier = activeTiers[0];
      const currentPrice = currentTier
        ? Number(currentTier.price)
        : Number(zone.regularPrice);
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
        color: zone.color || '#3B82F6',
        benefits: zone.benefits,
        regularPrice: Number(zone.regularPrice),
        currentPrice,
        serviceFee: Number(zone.serviceFee) || 0,
        feeIncluded: Boolean(zone.feeIncluded),
        activeTierName,
        capacity: cap,
        remainingTickets,
        isSoldOut: remainingTickets <= 0,
      };
    });

    // 5. Mapear Funciones
    const mappedShows = (event.shows || []).map((show) => ({
      id: show.id.toString(),
      publicUuid: show.publicUuid,
      name: show.name,
      startTime: new Date(show.startTime).toISOString(),
      durationHours: show.durationHours || 2,
    }));

    // 6. Normalizar LandingConfig
    const rawConfig = event.landingConfig || {};
    const landingConfig = {
      theme: {
        primaryColor: rawConfig.theme?.primaryColor || '#6366F1',
        backgroundType: rawConfig.theme?.backgroundType || 'color',
        backgroundColor: rawConfig.theme?.backgroundColor || '#18181B',
        backgroundPatternUrl: rawConfig.theme?.backgroundPatternUrl || null,
      },
      header: {
        title: rawConfig.header?.title || event.name,
        subtitle: rawConfig.header?.subtitle || 'EXPERIENCIA EXCLUSIVA',
        ctaText: rawConfig.header?.ctaText || 'Comprar Entradas Oficiales',
        headerImageUrl:
          rawConfig.header?.headerImageUrl || banner?.imageUrl || null,
        videoTeaserUrl:
          rawConfig.header?.videoTeaserUrl || event.promoVideoUrl || null,
      },
      body: {
        aboutText: rawConfig.body?.aboutText || event.description || null,
        bodyImageUrl: rawConfig.body?.bodyImageUrl || null,
        highlight1: rawConfig.body?.highlight1 || null,
        highlight2: rawConfig.body?.highlight2 || null,
        highlight3: rawConfig.body?.highlight3 || null,
        highlight4: rawConfig.body?.highlight4 || null,
      },
      footer: {
        footerImageUrl: rawConfig.footer?.footerImageUrl || null,
        tiktokUrl:
          rawConfig.footer?.tiktokUrl || event.socialLinks?.tiktokUrl || null,
        facebookUrl:
          rawConfig.footer?.facebookUrl ||
          event.socialLinks?.facebookUrl ||
          null,
        instagramUrl:
          rawConfig.footer?.instagramUrl ||
          event.socialLinks?.instagramUrl ||
          null,
      },
    };

    const responseDto = plainToInstance(
      EventLandingResponseDto,
      {
        id: event.id.toString(),
        publicUuid: event.publicUuid,
        slug: event.slug,
        name: event.name,
        category: event.category,
        venue: event.venue,
        address: event.address,
        city,
        hasLandingPage: event.hasLandingPage,
        bannerUrl: banner?.imageUrl || null,
        zoneMapUrl: zoneMapImg?.imageUrl || null,
        termsAndConditionsUrl: event.termsAndConditionsUrl,
        ageRestriction: event.ageRestriction,
        landingConfig,
        shows: mappedShows,
        zones: mappedZones,
        faqs: event.faqs || [],
        isPreview: isPreviewMode,
      },
      { excludeExtraneousValues: true },
    );

    // 7. Guardar en Redis con TTL de 15 minutos (Solo si no es vista previa)
    if (!isPreviewMode) {
      await this.redisService.set(
        cacheKey,
        responseDto,
        REDIS_DEFAULT_TTL.EVENT_LANDING_SECONDS,
      );
      this.logger.debug(
        `[Redis Cache SET] Landing guardado en [${cacheKey}] con TTL de 15 minutos.`,
      );
    }

    return responseDto;
  }
}
