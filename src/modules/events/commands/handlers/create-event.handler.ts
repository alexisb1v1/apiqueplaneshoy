import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { CreateEventCommand } from '@events/commands/impl/create-event.command';
import { EventEntity } from '@events/domain/entities/event.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ZonePricingTierEntity } from '@events/domain/entities/zone-pricing-tier.entity';
import { EventImageEntity } from '@events/domain/entities/event-image.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { AppError } from '@common/errors/app-errors';

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

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
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
  ) {}

  /**
   * Crea un nuevo evento en estado borrador ('draft') con todo su agregado de funciones,
   * localidades, preventas escalonadas, cupones y configuración de landing page.
   */
  async execute(
    command: CreateEventCommand,
  ): Promise<Result<EventEntity, AppError>> {
    const { publicUuid, dto } = command;

    const user = await this.userRepository.findOne({
      where: { publicUuid },
    });

    if (!user) {
      return err('NOT_FOUND');
    }

    // Sincronizar o activar el perfil de organizador
    let userModified = false;
    if (!user.isOrganizer) {
      user.isOrganizer = true;
      userModified = true;
    }
    if (dto.organizerName && dto.organizerName.trim() !== '') {
      user.organizerName = dto.organizerName.trim();
      userModified = true;
    } else if (!user.organizerName) {
      user.organizerName = user.name;
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
      const baseForSlug = dto.slug && dto.slug.trim() !== '' ? dto.slug.trim() : dto.title;
      const generatedSlug = slugify(baseForSlug);

      const resolvedEventLimit = Math.max(1, Number(dto.userTicketLimit) || 6);

      const event = this.eventRepository.create({
        name: dto.title,
        slug: generatedSlug,
        description: dto.description || null,
        organizerId: user.id,
        category: (dto.category || 'CONCERTS').toUpperCase(),
        tags: dto.tags || [],
        venue: dto.venue || dto.location || null,
        address: dto.address || dto.location || null,
        addressReference: dto.addressReference || null,
        ubigeoCode: dto.ubigeoCode || null,
        coordinates: dto.coordinates || null,
        googleMapsUrl: dto.googleMapsUrl || null,
        ageRestriction: dto.ageRestriction || 'ALL_AGES',
        userTicketLimit: resolvedEventLimit,
        entryRequirements: dto.entryRequirements || null,
        openingHoursComment: dto.openingHoursComment || null,
        termsAndConditionsUrl: dto.termsAndConditionsUrl || null,
        faqs: dto.faqs || null,
        hasLandingPage: dto.hasLandingPage || false,
        landingConfig: dto.landingConfig || null,
        status: 'draft',
      });

      const savedEvent = await this.eventRepository.save(event);

      // 1. Guardar Funciones (Shows)
      if (dto.shows && dto.shows.length > 0) {
        for (const s of dto.shows) {
          const showDate = s.startTime ? new Date(s.startTime) : new Date();
          const salesEnd = s.salesEndAt ? new Date(s.salesEndAt) : null;
          const show = this.showRepository.create({
            eventId: savedEvent.id,
            name: s.name || null,
            startTime: isNaN(showDate.getTime()) ? new Date() : showDate,
            salesEndAt: salesEnd && !isNaN(salesEnd.getTime()) ? salesEnd : null,
            durationHours: s.durationHours ? Number(s.durationHours) : 2,
            status: 'scheduled',
          });
          await this.showRepository.save(show);
        }
      } else {
        const showDate = dto.date ? new Date(dto.date) : new Date();
        const show = this.showRepository.create({
          eventId: savedEvent.id,
          name: 'Función Principal',
          startTime: isNaN(showDate.getTime()) ? new Date() : showDate,
          durationHours: 2,
          status: 'scheduled',
        });
        await this.showRepository.save(show);
      }

      // 2. Guardar Zonas y Preventas Escalonadas (Tiers)
      if (dto.zones && dto.zones.length > 0) {
        for (const z of dto.zones) {
          const requestedPerOrder = Math.max(1, Number(z.maxTicketsPerOrder) || 4);
          const zone = this.zoneRepository.create({
            eventId: savedEvent.id,
            name: z.name || 'General',
            title: z.title || null,
            color: z.color || '#3B82F6',
            capacity: Number(z.capacity) || 100,
            regularPrice: Number(z.regularPrice) || 0,
            serviceFee: Number(z.serviceFee) || 0,
            benefits: z.benefits || null,
            maxTicketsPerOrder: Math.min(requestedPerOrder, resolvedEventLimit),
            salesStartAt: z.salesStartAt ? new Date(z.salesStartAt) : null,
          });
          const savedZone = await this.zoneRepository.save(zone);

          if (z.tiers && z.tiers.length > 0) {
            let tierNum = 1;
            for (const t of z.tiers) {
              const endAtDate = t.endAt ? new Date(t.endAt) : null;
              const tier = this.tierRepository.create({
                zoneId: savedZone.id,
                tierNumber: t.tierNumber || tierNum++,
                name: t.name,
                price: Number(t.price),
                capacity: Number(t.capacity),
                endAt: endAtDate && !isNaN(endAtDate.getTime()) ? endAtDate : null,
                isActive: true,
              });
              await this.tierRepository.save(tier);
            }
          }
        }
      } else {
        const zone = this.zoneRepository.create({
          eventId: savedEvent.id,
          name: 'General',
          title: 'Entrada General',
          regularPrice: Number(dto.price) || 0,
          capacity: Number(dto.capacity) || 100,
          color: '#3B82F6',
        });
        await this.zoneRepository.save(zone);
      }

      // 3. Guardar Cupones
      if (dto.coupons && dto.coupons.length > 0) {
        for (const c of dto.coupons) {
          const expDate = c.expiresAt ? new Date(c.expiresAt) : null;
          const coupon = this.couponRepository.create({
            eventId: savedEvent.id,
            organizerId: user.id,
            code: c.code.trim().toUpperCase(),
            discountType: c.discountType === 'fixed' ? 'fixed' : 'percentage',
            discountValue: Number(c.discountValue) || 0,
            usageType: c.usageType === 'single_use' ? 'single_use' : 'reusable',
            maxUses: c.maxUses ? Number(c.maxUses) : null,
            expiresAt: expDate && !isNaN(expDate.getTime()) ? expDate : null,
            isActive: true,
          });
          await this.couponRepository.save(coupon);
        }
      }

      // 4. Guardar Imágenes
      if (dto.images && dto.images.length > 0) {
        for (let idx = 0; idx < dto.images.length; idx++) {
          const img = dto.images[idx];
          if (img.imageUrl) {
            const image = this.eventImageRepository.create({
              eventId: savedEvent.id,
              imageUrl: img.imageUrl,
              imageType: img.imageType || 'gallery',
              sortOrder: img.sortOrder ?? idx,
            });
            await this.eventImageRepository.save(image);
          }
        }
      } else if (dto.bannerUrl) {
        const image = this.eventImageRepository.create({
          eventId: savedEvent.id,
          imageUrl: dto.bannerUrl,
          imageType: 'banner',
          sortOrder: 0,
        });
        await this.eventImageRepository.save(image);
      }

      return ok(savedEvent);
    } catch {
      return err('INTERNAL_ERROR');
    }
  }
}
