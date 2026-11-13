import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '../../../../common/errors/app-errors';
import { EventEntity } from '../../domain/entities/event.entity';
import { ShowEntity } from '../../domain/entities/show.entity';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { TicketEntity } from '../../../orders/domain/entities/ticket.entity';
import { OrderEntity } from '../../../orders/domain/entities/order.entity';
import { resolveCityFromUbigeo } from '../../constants/event-constants';
import { GetOrganizerEventsQuery } from '../impl/get-organizer-events.query';
import {
  OrganizerDraftChecklistDto,
  OrganizerEventResponseDto,
  OrganizerEventZoneResponseDto,
} from '../../dto/organizer-event.response.dto';

interface ZoneAggRow {
  eventId: string;
  zoneId: string;
  soldCount: string;
  grossRevenue: string;
}

interface OrderDiscountAggRow {
  orderId: string;
  eventId: string;
  discountAmount: string;
}

@QueryHandler(GetOrganizerEventsQuery)
export class GetOrganizerEventsHandler
  implements IQueryHandler<GetOrganizerEventsQuery, Result<OrganizerEventResponseDto[], AppError>>
{
  private readonly logger = new Logger(GetOrganizerEventsHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lista todos los eventos del organizador autenticado con conteo real de ventas por zona,
   * precios vigentes de preventa, recaudación descontando cupones y estado de borrador/liquidación.
   */
  async execute(
    query: GetOrganizerEventsQuery,
  ): Promise<Result<OrganizerEventResponseDto[], AppError>> {
    if (!query.publicUuid) {
      return err('UNAUTHORIZED');
    }

    const user = await this.userRepository.findOne({
      where: { publicUuid: query.publicUuid },
    });

    if (!user) {
      return err('UNAUTHORIZED');
    }

    try {
      // Cálculo de fecha de corte para el filtro de período (3m por defecto para evitar sobrecarga)
      const periodParam = query.period || '3m';
      let minCreatedAt: Date | null = null;
      if (periodParam !== 'all') {
        const months = periodParam === '12m' ? 12 : periodParam === '6m' ? 6 : 3;
        minCreatedAt = new Date();
        minCreatedAt.setMonth(minCreatedAt.getMonth() - months);
      }

      const whereCondition: any = { organizerId: user.id };
      if (minCreatedAt) {
        whereCondition.createdAt = MoreThanOrEqual(minCreatedAt);
      }

      const events = await this.eventRepository.find({
        where: whereCondition,
        relations: {
          images: true,
          shows: true,
          zones: {
            pricingTiers: true,
          },
          settlement: true,
          advances: true,
        },
        order: { createdAt: 'DESC' },
      });

      if (!events || events.length === 0) {
        return ok([]);
      }

      const eventIds = events.map((e) => e.id);

      // Agregación real de boletos pagados/usados por evento y zona (consultas parametrizadas)
      const [zoneSalesRows, orderDiscountRows] = await Promise.all([
        this.dataSource
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('s.event_id', 'eventId')
          .addSelect('t.zone_id', 'zoneId')
          .addSelect('COUNT(t.id)', 'soldCount')
          .addSelect('COALESCE(SUM(t.paid_base_price), 0)', 'grossRevenue')
          .where('s.event_id IN (:...eventIds)', { eventIds })
          .andWhere('t.status IN (:...soldStatuses)', { soldStatuses: ['sold', 'used'] })
          .groupBy('s.event_id')
          .addGroupBy('t.zone_id')
          .getRawMany<ZoneAggRow>(),
        this.dataSource
          .createQueryBuilder(OrderEntity, 'o')
          .leftJoin(TicketEntity, 't', 't.order_id = o.id')
          .leftJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('DISTINCT o.id', 'orderId')
          .addSelect('COALESCE(o.event_id, s.event_id)', 'eventId')
          .addSelect('COALESCE(o.discount_amount, 0)', 'discountAmount')
          .where('o.status = :paidStatus', { paidStatus: 'paid' })
          .andWhere('(o.event_id IN (:...eventIds) OR s.event_id IN (:...eventIds))', { eventIds })
          .getRawMany<OrderDiscountAggRow>(),
      ]);

      const zoneMetricsMap = new Map<string, { soldCount: number; grossRevenue: number }>();
      for (const row of zoneSalesRows) {
        zoneMetricsMap.set(`${row.eventId}:${row.zoneId}`, {
          soldCount: Number(row.soldCount) || 0,
          grossRevenue: Number(row.grossRevenue) || 0,
        });
      }

      // Deduplicar orden por si el join con tickets arrojó el mismo orderId
      const seenOrders = new Set<string>();
      const couponDiscountByEvent = new Map<string, number>();
      for (const row of orderDiscountRows) {
        if (!row.orderId || !row.eventId || seenOrders.has(row.orderId)) {
          continue;
        }
        seenOrders.add(row.orderId);
        const current = couponDiscountByEvent.get(String(row.eventId)) || 0;
        couponDiscountByEvent.set(
          String(row.eventId),
          Math.round((current + (Number(row.discountAmount) || 0)) * 100) / 100,
        );
      }

      const now = new Date();
      let mappedEvents = events.map((event) =>
        this.mapEventToOrganizerDto(event, zoneMetricsMap, couponDiscountByEvent, now),
      );

      // Filtros opcionales de consulta
      const normalizedStatus = query.status?.trim().toLowerCase();
      if (normalizedStatus && normalizedStatus !== 'all') {
        mappedEvents = mappedEvents.filter((item) => {
          if (normalizedStatus === 'on_sale') {
            return item.status === 'published' && !item.isSoldOut;
          }
          if (normalizedStatus === 'sold_out') {
            return item.status === 'published' && item.isSoldOut;
          }
          return item.status === normalizedStatus;
        });
      }

      const searchTerm = query.search?.trim().toLowerCase();
      if (searchTerm) {
        mappedEvents = mappedEvents.filter(
          (item) =>
            item.name.toLowerCase().includes(searchTerm) ||
            (item.venue || '').toLowerCase().includes(searchTerm) ||
            item.city.toLowerCase().includes(searchTerm) ||
            item.eventCode.toLowerCase().includes(searchTerm),
        );
      }

      return ok(mappedEvents);
    } catch (error) {
      this.logger.error(
        `Error listando eventos del organizador ${query.publicUuid}: ${(error as Error).message}`,
      );
      return err('INTERNAL_ERROR');
    }
  }

  private mapEventToOrganizerDto(
    event: EventEntity,
    zoneMetricsMap: Map<string, { soldCount: number; grossRevenue: number }>,
    couponDiscountByEvent: Map<string, number>,
    now: Date,
  ): OrganizerEventResponseDto {
    const sortedShows = [...(event.shows || [])].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    const firstShow = sortedShows[0] || null;
    const lastShow = sortedShows[sortedShows.length - 1] || null;

    const bannerImage =
      event.images?.find((img) => img.imageType === 'banner')?.imageUrl ||
      event.images?.[0]?.imageUrl ||
      null;

    const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);
    const cityName =
      cityInfo.name && cityInfo.name !== 'Perú'
        ? cityInfo.name
        : event.address || event.venue || 'Perú';

    let hasAnyActivePresale = false;
    let activePresaleLabel = '';

    let totalCapacity = 0;
    let totalTicketsSold = 0;
    let totalGrossRevenue = 0;
    let totalTargetRevenue = 0;

    const mappedZones: OrganizerEventZoneResponseDto[] = [...(event.zones || [])]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((zone) => {
        const cap = Number(zone.capacity) || 0;
        const agg = zoneMetricsMap.get(`${event.id}:${zone.id}`);
        const sold = agg ? agg.soldCount : Number(zone.soldCount) || 0;
        const locked = Number(zone.lockedCount) || 0;
        const remaining = Math.max(0, cap - sold - locked);
        const occupancy = cap > 0 ? Math.min(100, Math.round((sold / cap) * 1000) / 10) : 0;
        const regularPrice = Number(zone.regularPrice) || 0;

        const activeTiers = (zone.pricingTiers || [])
          .filter(
            (tier) =>
              tier.isActive &&
              (!tier.endAt || new Date(tier.endAt) >= now) &&
              Number(tier.soldCount) < Number(tier.capacity),
          )
          .sort((a, b) => a.tierNumber - b.tierNumber);

        const currentTier = activeTiers[0];
        const isPresaleActive = Boolean(currentTier);
        const activePrice = currentTier ? Number(currentTier.price) : regularPrice;
        const activeTierName = currentTier ? currentTier.name : 'Venta Regular';

        if (isPresaleActive && !hasAnyActivePresale) {
          hasAnyActivePresale = true;
          activePresaleLabel = currentTier.name;
        }

        const zoneRevenue = agg ? agg.grossRevenue : 0;
        const zoneServiceFee = Math.max(0, Number(zone.serviceFee) || 0);
        const netUnitRegularPrice = zone.feeIncluded
          ? Math.max(0, regularPrice - Math.min(zoneServiceFee, regularPrice))
          : regularPrice;

        totalCapacity += cap;
        totalTicketsSold += sold;
        totalGrossRevenue += zoneRevenue;
        totalTargetRevenue += cap * netUnitRegularPrice;

        let statusBadge = 'Disponible';
        if (cap > 0 && remaining <= 0) {
          statusBadge = 'Agotado';
        } else if (occupancy >= 85) {
          statusBadge = 'Casi agotado';
        } else if (occupancy >= 60) {
          statusBadge = 'Alta demanda';
        } else if (isPresaleActive) {
          statusBadge = `Preventa`;
        }

        return plainToInstance(
          OrganizerEventZoneResponseDto,
          {
            id: zone.id.toString(),
            publicUuid: zone.publicUuid,
            name: zone.name,
            title: zone.title,
            color: zone.color || '#6366F1',
            capacity: cap,
            soldCount: sold,
            lockedCount: locked,
            remainingTickets: remaining,
            occupancyPercentage: occupancy,
            regularPrice,
            activePrice,
            activeTierName,
            isPresaleActive,
            statusBadge,
            revenue: Math.round(zoneRevenue * 100) / 100,
          },
          { excludeExtraneousValues: true },
        );
      });

    const totalRemaining = Math.max(0, totalCapacity - totalTicketsSold);
    const totalOccupancy =
      totalCapacity > 0
        ? Math.min(100, Math.round((totalTicketsSold / totalCapacity) * 1000) / 10)
        : 0;

    const couponsDiscount = couponDiscountByEvent.get(String(event.id)) || 0;
    const netSalesRevenue = Math.max(
      0,
      Math.round((totalGrossRevenue - couponsDiscount) * 100) / 100,
    );

    const isSoldOut =
      event.status === 'published' && totalCapacity > 0 && totalTicketsSold >= totalCapacity;

    let statusLabel = 'Borrador';
    if (event.status === 'published') {
      if (isSoldOut) {
        statusLabel = 'Sold Out';
      } else if (hasAnyActivePresale && activePresaleLabel) {
        statusLabel = `En Venta · ${activePresaleLabel}`;
      } else {
        statusLabel = 'En Venta';
      }
    } else if (event.status === 'observed') {
      statusLabel = 'Observado';
    } else if (event.status === 'in_review') {
      statusLabel = 'En Revisión';
    } else if (event.status === 'completed') {
      statusLabel = 'Finalizado';
    } else if (event.status === 'paused') {
      statusLabel = 'Pausado';
    } else if (event.status === 'cancelled') {
      statusLabel = 'Cancelado';
    }

    const hasShows = sortedShows.length > 0;
    const hasZones = mappedZones.length > 0;
    const hasBanner = Boolean(bannerImage);
    const missingItems: string[] = [];
    if (!hasShows) missingItems.push('Agregar al menos una función o fecha');
    if (!hasZones) missingItems.push('Definir zonas y tarifas');
    if (!hasBanner) missingItems.push('Subir imagen de portada');

    // Ponderación simple real de preparación: título+recinto base (40%) + shows (20%) + zonas (20%) + banner (20%)
    const baseReady = event.name && event.venue ? 40 : 20;
    const completionPercent = Math.min(
      100,
      baseReady + (hasShows ? 20 : 0) + (hasZones ? 20 : 0) + (hasBanner ? 20 : 0),
    );

    const draftChecklist = plainToInstance(
      OrganizerDraftChecklistDto,
      {
        hasShows,
        hasZones,
        hasBanner,
        completionPercent,
        missingItems,
      },
      { excludeExtraneousValues: true },
    );

    return plainToInstance(
      OrganizerEventResponseDto,
      {
        id: event.id.toString(),
        publicUuid: event.publicUuid,
        eventCode: `#EV-${event.publicUuid.substring(0, 8).toUpperCase()}`,
        slug: event.slug,
        name: event.name,
        category: event.category || 'CONCERTS',
        status: event.status,
        observationReason: event.observationReason || null,
        isSoldOut,
        statusLabel,
        hasLandingPage: Boolean(event.hasLandingPage),
        imageUrl: bannerImage,
        venue: event.venue,
        city: cityName,
        firstShowStartTime: firstShow ? new Date(firstShow.startTime).toISOString() : null,
        dateFormatted: this.formatShowRange(firstShow, lastShow),
        showsCount: sortedShows.length,
        capacity: totalCapacity,
        ticketsSold: totalTicketsSold,
        remainingTickets: totalRemaining,
        occupancyPercentage: totalOccupancy,
        grossRevenue: Math.round(totalGrossRevenue * 100) / 100,
        couponsDiscountAmount: Math.round(couponsDiscount * 100) / 100,
        netSalesRevenue,
        targetRevenue: Math.round(totalTargetRevenue * 100) / 100,
        settlementStatus: event.settlement?.status || null,
        advancesCount: (event.advances || []).length,
        createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : now.toISOString(),
        draftChecklist,
        zones: mappedZones,
      },
      { excludeExtraneousValues: true },
    );
  }

  private formatShowRange(firstShow: ShowEntity | null, lastShow: ShowEntity | null): string {
    if (!firstShow?.startTime) {
      return 'Fecha por definir';
    }

    const fmt = new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Lima',
    });

    const firstDate = fmt.format(new Date(firstShow.startTime));
    if (!lastShow?.startTime) {
      return firstDate;
    }

    const lastDate = fmt.format(new Date(lastShow.startTime));
    return firstDate === lastDate ? firstDate : `${firstDate} — ${lastDate}`;
  }
}
