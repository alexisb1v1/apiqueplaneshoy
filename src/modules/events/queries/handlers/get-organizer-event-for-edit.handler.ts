import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { EventEntity } from '@events/domain/entities/event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { GetOrganizerEventForEditQuery } from '../impl/get-organizer-event-for-edit.query';
import { OrganizerEventEditResponseDto } from '../../dto/organizer-event-edit.response.dto';

@QueryHandler(GetOrganizerEventForEditQuery)
export class GetOrganizerEventForEditHandler
  implements
    IQueryHandler<
      GetOrganizerEventForEditQuery,
      Result<OrganizerEventEditResponseDto, AppError>
    >
{
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
  ) {}

  async execute(
    query: GetOrganizerEventForEditQuery,
  ): Promise<Result<OrganizerEventEditResponseDto, AppError>> {
    const { publicUuid, eventIdentifier } = query;

    const user = await this.userRepository.findOne({
      where: { publicUuid },
    });

    if (!user) {
      return err('UNAUTHORIZED');
    }

    const isNumeric = /^\d+$/.test(eventIdentifier);
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        eventIdentifier,
      );

    let whereClause: Record<string, any>;
    if (isNumeric) {
      whereClause = { id: parseInt(eventIdentifier, 10) };
    } else if (isUuid) {
      whereClause = { publicUuid: eventIdentifier };
    } else {
      whereClause = { slug: eventIdentifier };
    }

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
      return err('EVENT_NOT_FOUND');
    }

    // Autorización BOLA (OWASP API1)
    if (event.organizerId !== user.id && user.role !== 'admin') {
      return err('FORBIDDEN');
    }

    // Obtener cupones del evento
    const coupons = await this.couponRepository.find({
      where: { eventId: event.id },
      order: { createdAt: 'ASC' },
    });

    const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);
    const readableLocation =
      cityInfo.name && cityInfo.name !== 'Perú'
        ? cityInfo.name
        : event.venue || '';

    const bannerImg = event.images?.find((img) => img.imageType === 'banner');
    const zoneMapImg = event.images?.find((img) => img.imageType === 'zone_map');
    const galleryImgs = (event.images || [])
      .filter((img) => img.imageType === 'gallery')
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((img) => img.imageUrl);

    const mappedShows = (event.shows || []).map((s) => ({
      id: s.id.toString(),
      name: s.name || '',
      startTime: s.startTime ? s.startTime.toISOString() : '',
      salesEndAt: s.salesEndAt ? s.salesEndAt.toISOString() : undefined,
      durationHours: s.durationHours || 2,
      status: s.status || 'scheduled',
    }));

    const mappedZones = (event.zones || []).map((z) => ({
      id: z.id.toString(),
      publicUuid: z.publicUuid,
      name: z.name,
      title: z.title || '',
      color: z.color || '#3B82F6',
      capacity: Number(z.capacity) || 0,
      regularPrice: Number(z.regularPrice) || 0,
      serviceFee: Number(z.serviceFee) || 0,
      feeIncluded: Boolean(z.feeIncluded),
      benefits: z.benefits || '',
      maxTicketsPerOrder: z.maxTicketsPerOrder || 4,
      salesStartAt: z.salesStartAt ? z.salesStartAt.toISOString() : undefined,
      soldCount: Number(z.soldCount) || 0,
      tiers: (z.pricingTiers || []).map((t) => ({
        id: t.id.toString(),
        tierNumber: t.tierNumber,
        name: t.name,
        price: Number(t.price),
        capacity: Number(t.capacity),
        endAt: t.endAt ? t.endAt.toISOString() : undefined,
        soldCount: Number(t.soldCount) || 0,
      })),
    }));

    const mappedCoupons = coupons.map((c) => ({
      id: c.id.toString(),
      code: c.code,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      usageType: c.usageType,
      maxUses: c.maxUses ? Number(c.maxUses) : undefined,
      usedCount: Number(c.usedCount) || 0,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : undefined,
    }));

    const mappedImages = (event.images || []).map((img) => ({
      imageUrl: img.imageUrl,
      imageType: img.imageType,
      sortOrder: img.sortOrder || 0,
    }));

    const responseDto = plainToInstance(
      OrganizerEventEditResponseDto,
      {
        id: event.id.toString(),
        publicUuid: event.publicUuid,
        title: event.name,
        slug: event.slug,
        description: event.description || '',
        category: event.category,
        tags: event.tags || [],
        venue: event.venue || '',
        address: event.address || '',
        addressReference: event.addressReference || '',
        ubigeoCode: event.ubigeoCode || '',
        readableLocation,
        coordinates: event.coordinates || '',
        googleMapsUrl: event.googleMapsUrl || '',
        ageRestriction: event.ageRestriction || 'ALL_AGES',
        userTicketLimit: event.userTicketLimit || 4,
        entryRequirements: event.entryRequirements || '',
        openingHoursComment: event.openingHoursComment || '',
        termsAndConditionsUrl: event.termsAndConditionsUrl || '',
        faqs: event.faqs || [],
        hasLandingPage: Boolean(event.hasLandingPage),
        landingConfig: event.landingConfig || undefined,
        promoVideoUrl: event.promoVideoUrl || '',
        socialLinks: event.socialLinks || undefined,
        status: event.status,
        bannerUrl: bannerImg?.imageUrl || '',
        zoneMapUrl: zoneMapImg?.imageUrl || '',
        galleryUrls: galleryImgs,
        shows: mappedShows,
        zones: mappedZones,
        coupons: mappedCoupons,
        images: mappedImages,
        organizerName: user.organizerName || user.name,
        organizerDocumentType: user.organizerDocumentType || '',
        organizerDocumentNumber: user.organizerDocumentNumber || '',
        organizerPhone: user.organizerPhone || '',
        organizerLogoUrl: user.organizerLogoUrl || '',
      },
      { excludeExtraneousValues: true },
    );

    return ok(responseDto);
  }
}
