import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { AppError } from '@common/errors/app-errors';
import { UpdateEventCommand } from '@events/commands/impl/update-event.command';
import { EventEntity } from '@events/domain/entities/event.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ZonePricingTierEntity } from '@events/domain/entities/zone-pricing-tier.entity';
import { EventImageEntity } from '@events/domain/entities/event-image.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { calculatePlatformFee } from '@orders/application/services/platform-fee.service';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS } from '@modules/redis/redis.constants';
import { SearchService } from '../../../search/services/search.service';

function slugify(text: string): string {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${normalized || 'evento'}-${randomSuffix}`;
}

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(ShowEntity)
    private readonly showRepository: Repository<ShowEntity>,
    @InjectRepository(ZoneEntity)
    private readonly zoneRepository: Repository<ZoneEntity>,
    @InjectRepository(ZonePricingTierEntity)
    private readonly tierRepository: Repository<ZonePricingTierEntity>,
    @InjectRepository(EventImageEntity)
    private readonly eventImageRepository: Repository<EventImageEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    private readonly redisService: RedisService,
    private readonly searchService: SearchService,
    private readonly dataSource: DataSource,
  ) {}

  async execute(
    command: UpdateEventCommand,
  ): Promise<Result<EventEntity, AppError>> {
    const { publicUuid, eventIdentifier, dto } = command;

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
        shows: true,
        zones: {
          pricingTiers: true,
        },
        images: true,
      },
    });

    if (!event) {
      return err('EVENT_NOT_FOUND');
    }

    // Autorización BOLA (OWASP API1)
    if (event.organizerId !== user.id && user.role !== 'admin') {
      return err('FORBIDDEN');
    }

    // Actualizar datos del organizador si se proporcionaron
    let userModified = false;
    if (dto.organizerName && dto.organizerName.trim() !== '') {
      user.organizerName = dto.organizerName.trim();
      userModified = true;
    }
    if (dto.organizerDocumentType) {
      user.organizerDocumentType = dto.organizerDocumentType.trim();
      userModified = true;
    }
    if (dto.organizerDocumentNumber) {
      user.organizerDocumentNumber = dto.organizerDocumentNumber.trim();
      userModified = true;
    }
    if (dto.organizerPhone) {
      user.organizerPhone = dto.organizerPhone.trim();
      userModified = true;
    }
    if (dto.organizerLogoUrl) {
      user.organizerLogoUrl = dto.organizerLogoUrl.trim();
      userModified = true;
    }
    if (userModified) {
      await this.userRepository.save(user);
    }

    try {
      const resolvedEventLimit = dto.userTicketLimit !== undefined
        ? Math.max(1, Number(dto.userTicketLimit))
        : event.userTicketLimit;

      const resolvedPromoVideoUrl =
        dto.promoVideoUrl !== undefined
          ? (dto.promoVideoUrl?.trim() || null)
          : event.promoVideoUrl;

      let resolvedSocialLinks = event.socialLinks;
      if (dto.socialLinks !== undefined) {
        const hasLinks = Boolean(
          dto.socialLinks?.instagramUrl?.trim() ||
            dto.socialLinks?.facebookUrl?.trim() ||
            dto.socialLinks?.tiktokUrl?.trim(),
        );
        resolvedSocialLinks = hasLinks
          ? {
              instagramUrl: dto.socialLinks?.instagramUrl?.trim() || null,
              facebookUrl: dto.socialLinks?.facebookUrl?.trim() || null,
              tiktokUrl: dto.socialLinks?.tiktokUrl?.trim() || null,
            }
          : null;
      }

      // Si se envía nuevo slug o título
      if (dto.title !== undefined) {
        event.name = dto.title.trim();
      }
      if (dto.slug !== undefined && dto.slug.trim() !== '') {
        event.slug = slugify(dto.slug.trim());
      }
      if (dto.description !== undefined) {
        event.description = dto.description.trim() || null;
      }
      if (dto.category !== undefined) {
        event.category = dto.category.toUpperCase();
      }
      if (dto.tags !== undefined) {
        event.tags = dto.tags;
      }
      if (dto.venue !== undefined || dto.location !== undefined) {
        event.venue = (dto.venue || dto.location || '').trim() || null;
      }
      if (dto.address !== undefined) {
        event.address = dto.address.trim() || null;
      }
      if (dto.addressReference !== undefined) {
        event.addressReference = dto.addressReference.trim() || null;
      }
      if (dto.ubigeoCode !== undefined) {
        event.ubigeoCode = dto.ubigeoCode || null;
      }
      if (dto.coordinates !== undefined) {
        event.coordinates = dto.coordinates || null;
      }
      if (dto.googleMapsUrl !== undefined) {
        event.googleMapsUrl = dto.googleMapsUrl.trim() || null;
      }
      if (dto.ageRestriction !== undefined) {
        event.ageRestriction = dto.ageRestriction;
      }
      if (dto.entryRequirements !== undefined) {
        event.entryRequirements = dto.entryRequirements.trim() || null;
      }
      if (dto.openingHoursComment !== undefined) {
        event.openingHoursComment = dto.openingHoursComment.trim() || null;
      }
      if (dto.termsAndConditionsUrl !== undefined) {
        event.termsAndConditionsUrl = dto.termsAndConditionsUrl.trim() || null;
      }
      if (dto.faqs !== undefined) {
        event.faqs = dto.faqs;
      }
      if (dto.hasLandingPage !== undefined) {
        event.hasLandingPage = dto.hasLandingPage;
      }
      if (dto.landingConfig !== undefined) {
        event.landingConfig = dto.landingConfig;
      }

      event.userTicketLimit = resolvedEventLimit;
      event.promoVideoUrl = resolvedPromoVideoUrl;
      event.socialLinks = resolvedSocialLinks;

      const updatedEvent = await this.eventRepository.save(event);

      // Transacción para sincronizar colecciones (shows, zones, tiers, coupons, images)
      await this.dataSource.transaction(async (manager) => {
        // 1. Sincronizar Shows
        if (dto.shows && dto.shows.length > 0) {
          await manager.delete(ShowEntity, { eventId: updatedEvent.id });
          for (const s of dto.shows) {
            const showDate = s.startTime ? new Date(s.startTime) : new Date();
            const salesEnd = s.salesEndAt ? new Date(s.salesEndAt) : null;
            const show = manager.create(ShowEntity, {
              eventId: updatedEvent.id,
              name: s.name || null,
              startTime: isNaN(showDate.getTime()) ? new Date() : showDate,
              salesEndAt: salesEnd && !isNaN(salesEnd.getTime()) ? salesEnd : null,
              durationHours: s.durationHours ? Number(s.durationHours) : 2,
              status: 'scheduled',
            });
            await manager.save(show);
          }
        }

        // 2. Sincronizar Zonas y Preventas (Tiers)
        if (dto.zones && dto.zones.length > 0) {
          // Si el evento está en borrador o no tiene tickets vendidos, reemplazar limpiamente
          const existingZones = await manager.find(ZoneEntity, {
            where: { eventId: updatedEvent.id },
            relations: { pricingTiers: true },
          });

          for (const ez of existingZones) {
            if (ez.pricingTiers && ez.pricingTiers.length > 0) {
              await manager.delete(ZonePricingTierEntity, { zoneId: ez.id });
            }
          }
          await manager.delete(ZoneEntity, { eventId: updatedEvent.id });

          for (const z of dto.zones) {
            const requestedPerOrder = Math.max(1, Number(z.maxTicketsPerOrder) || 4);
            const regularPriceNum = Number(z.regularPrice) || 0;
            const officialFee = calculatePlatformFee(regularPriceNum);

            const zone = manager.create(ZoneEntity, {
              eventId: updatedEvent.id,
              name: z.name || 'General',
              title: z.title || null,
              color: z.color || '#3B82F6',
              capacity: Number(z.capacity) || 100,
              regularPrice: regularPriceNum,
              serviceFee: officialFee,
              feeIncluded: Boolean(z.feeIncluded),
              benefits: z.benefits || null,
              maxTicketsPerOrder: Math.min(requestedPerOrder, resolvedEventLimit),
              salesStartAt: z.salesStartAt ? new Date(z.salesStartAt) : null,
            });
            const savedZone = await manager.save(zone);

            if (z.tiers && z.tiers.length > 0) {
              let tierNum = 1;
              for (const t of z.tiers) {
                const endAtDate = t.endAt ? new Date(t.endAt) : null;
                const tier = manager.create(ZonePricingTierEntity, {
                  zoneId: savedZone.id,
                  tierNumber: t.tierNumber || tierNum++,
                  name: t.name,
                  price: Number(t.price),
                  capacity: Number(t.capacity),
                  endAt: endAtDate && !isNaN(endAtDate.getTime()) ? endAtDate : null,
                  isActive: true,
                });
                await manager.save(tier);
              }
            }
          }
        }

        // 3. Sincronizar Cupones
        if (dto.coupons !== undefined) {
          await manager.delete(CouponEntity, { eventId: updatedEvent.id });
          if (dto.coupons && dto.coupons.length > 0) {
            for (const c of dto.coupons) {
              const expDate = c.expiresAt ? new Date(c.expiresAt) : null;
              const coupon = manager.create(CouponEntity, {
                eventId: updatedEvent.id,
                organizerId: user.id,
                code: c.code.trim().toUpperCase(),
                discountType: c.discountType === 'fixed' ? 'fixed' : 'percentage',
                discountValue: Number(c.discountValue) || 0,
                usageType: c.usageType === 'single_use' ? 'single_use' : 'reusable',
                maxUses: c.maxUses ? Number(c.maxUses) : null,
                expiresAt: expDate && !isNaN(expDate.getTime()) ? expDate : null,
                isActive: true,
              });
              await manager.save(coupon);
            }
          }
        }

        // 4. Sincronizar Imágenes
        if (dto.images !== undefined || dto.bannerUrl !== undefined) {
          await manager.delete(EventImageEntity, { eventId: updatedEvent.id });
          if (dto.images && dto.images.length > 0) {
            for (let idx = 0; idx < dto.images.length; idx++) {
              const img = dto.images[idx];
              if (img.imageUrl) {
                const image = manager.create(EventImageEntity, {
                  eventId: updatedEvent.id,
                  imageUrl: img.imageUrl,
                  imageType: img.imageType || 'gallery',
                  sortOrder: img.sortOrder ?? idx,
                });
                await manager.save(image);
              }
            }
          } else if (dto.bannerUrl) {
            const image = manager.create(EventImageEntity, {
              eventId: updatedEvent.id,
              imageUrl: dto.bannerUrl,
              imageType: 'banner',
              sortOrder: 0,
            });
            await manager.save(image);
          }
        }
      });

      // Invalidar Cachés de Redis
      await this.redisService.del(REDIS_CACHE_KEYS.EVENTS.DETAIL(updatedEvent.publicUuid));
      await this.redisService.del(REDIS_CACHE_KEYS.EVENTS.DETAIL(updatedEvent.id.toString()));
      if (updatedEvent.slug) {
        await this.redisService.del(REDIS_CACHE_KEYS.EVENTS.LANDING(updatedEvent.slug));
        await this.redisService.del(REDIS_CACHE_KEYS.EVENTS.DETAIL(updatedEvent.slug));
      }
      if (updatedEvent.status === 'published') {
        await this.redisService.delPattern('qph:home:*');
        // Actualizar MeiliSearch si ya está publicado
        this.searchService.indexEvent({
          id: updatedEvent.id.toString(),
          publicUuid: updatedEvent.publicUuid,
          title: updatedEvent.name,
          slug: updatedEvent.slug,
          description: updatedEvent.description,
          category: updatedEvent.category,
          tags: updatedEvent.tags || [],
          venue: updatedEvent.venue,
          address: updatedEvent.address,
          ubigeoCode: updatedEvent.ubigeoCode,
          status: updatedEvent.status,
          minPrice: 0,
          date: updatedEvent.createdAt ? updatedEvent.createdAt.toISOString() : new Date().toISOString(),
          hasLandingPage: updatedEvent.hasLandingPage,
          isFeatured: updatedEvent.isFeatured,
        }).catch(() => {});
      }

      return ok(updatedEvent);
    } catch {
      return err('INTERNAL_ERROR');
    }
  }
}
