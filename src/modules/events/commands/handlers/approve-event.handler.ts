import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { ApproveEventCommand } from '../impl/approve-event.command';
import { EventEntity } from '@events/domain/entities/event.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { AppError } from '@common/errors/app-errors';
import { SearchService } from '../../../search/services/search.service';
import { QPH_FEE_RULES } from '../../../orders/application/services/platform-fee.service';

@CommandHandler(ApproveEventCommand)
export class ApproveEventHandler implements ICommandHandler<ApproveEventCommand, Result<EventEntity, AppError>> {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(ZoneEntity)
    private readonly zoneRepository: Repository<ZoneEntity>,
    private readonly searchService: SearchService,
  ) {}

  async execute(command: ApproveEventCommand): Promise<Result<EventEntity, AppError>> {
    const { eventIdentifier, approvedBy } = command;

    let event: EventEntity | null = null;
    const isNumeric = /^\d+$/.test(eventIdentifier);

    if (isNumeric) {
      event = await this.eventRepository.findOne({
        where: { id: eventIdentifier },
        relations: { zones: true },
      });
    } else {
      event = await this.eventRepository.findOne({
        where: { publicUuid: eventIdentifier },
        relations: { zones: true },
      });
    }

    if (!event) {
      return err('NOT_FOUND');
    }

    // 1. Obtener o consultar zonas del evento para congelar el snapshot
    let zones = event.zones;
    if (!zones || zones.length === 0) {
      zones = await this.zoneRepository.find({
        where: { eventId: event.id },
      });
    }

    // 2. Construir el snapshot tarifario inmutable
    const zonesSnapshot = (zones || []).map((z) => ({
      zoneId: String(z.id),
      zoneName: z.name,
      regularPrice: Number(z.regularPrice) || 0,
      serviceFee: Number(z.serviceFee) || 0,
      feeIncluded: Boolean(z.feeIncluded),
      capacity: Number(z.capacity) || 0,
    }));

    event.status = 'published';
    event.ticketeraFeeSnapshot = {
      approvedAt: new Date().toISOString(),
      approvedBy: approvedBy || 'backoffice_admin',
      rulesVersion: 'v1.0',
      feeRules: {
        ...QPH_FEE_RULES,
        TIER_3: {
          ...QPH_FEE_RULES.TIER_3,
          maxPrice: null, // Evitar Infinity en JSONB
        },
      },
      zones: zonesSnapshot,
    };

    const updated = await this.eventRepository.save(event);

    // 3. Indexar en Meilisearch
    await this.searchService
      .indexEvent({
        id: updated.id,
        publicUuid: updated.publicUuid,
        title: updated.name,
        slug: updated.slug,
        description: updated.description || '',
        category: updated.category,
        venue: updated.venue || '',
        address: updated.address || '',
        status: updated.status,
        minPrice: 0,
        hasLandingPage: updated.hasLandingPage,
        isFeatured: updated.isFeatured,
      })
      .catch(() => null);

    return ok(updated);
  }
}
