import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { EventEntity } from '@events/domain/entities/event.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ZonePricingTierEntity } from '@events/domain/entities/zone-pricing-tier.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { EventSettlementEntity } from '../../domain/entities/event-settlement.entity';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { UmamiAnalyticsService } from '../../services/umami-analytics.service';
import { GetOrganizerEventReportQuery } from '../impl/get-organizer-event-report.query';
import {
  OrganizerEventReportResponseDto,
  OrganizerEventReportEventDto,
  OrganizerEventReportSummaryDto,
  OrganizerEventReportZoneDto,
  OrganizerEventReportTierDto,
  OrganizerEventReportShowDto,
  OrganizerEventReportRecentOrderDto,
  OrganizerEventReportDailySalesDto,
} from '../../dto/organizer-event-report.response.dto';

interface ZoneSalesRow {
  zoneId: string;
  soldCount: string;
  usedCount: string;
  grossRevenue: string;
  serviceFeeTotal: string;
}

interface TierSalesRow {
  pricingTierId: string;
  soldCount: string;
}

interface ShowSalesRow {
  showId: string;
  soldCount: string;
  usedCount: string;
}

interface DailySalesRow {
  date: string;
  zoneId: string;
  ticketsSold: string;
  revenue: string;
}

function formatEventDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDate();
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours.toString().padStart(2, '0');

  return `${day} ${month} ${year} • ${hoursStr}:${minutes} ${ampm}`;
}

@QueryHandler(GetOrganizerEventReportQuery)
export class GetOrganizerEventReportHandler implements IQueryHandler<
  GetOrganizerEventReportQuery,
  Result<OrganizerEventReportResponseDto, AppError>
> {
  private readonly logger = new Logger(GetOrganizerEventReportHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly umamiAnalyticsService: UmamiAnalyticsService,
  ) {}

  async execute(
    query: GetOrganizerEventReportQuery,
  ): Promise<Result<OrganizerEventReportResponseDto, AppError>> {
    const { publicUuid, eventIdentifier } = query;

    if (!publicUuid) {
      return err('UNAUTHORIZED');
    }

    const user = await this.userRepository.findOne({
      where: { publicUuid },
    });

    if (!user) {
      return err('UNAUTHORIZED');
    }

    // Validación de permisos: solo usuarios con perfil activo de organizador (is_organizer = true)
    if (
      !user.isOrganizer ||
      (user.role !== 'customer' && user.role !== 'admin')
    ) {
      this.logger.warn(
        `Usuario ${user.id} sin permisos de organizador (rol=${user.role}, isOrganizer=${user.isOrganizer}) intentó acceder al reporte de ventas`,
      );
      return err('FORBIDDEN');
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
      return err('NOT_FOUND');
    }

    // Validación BOLA (Ownership): el evento debe pertenecer al organizador autenticado
    if (Number(event.organizerId) !== Number(user.id)) {
      this.logger.warn(
        `Usuario ${user.id} intentó acceder al reporte del evento ${event.id} propiedad de ${event.organizerId}`,
      );
      return err('FORBIDDEN');
    }

    try {
      const eventId = event.id;
      const now = new Date();

      // 1. Consultar ventas agregadas por Zona y por Tier
      const [
        zoneSalesRows,
        tierSalesRows,
        showSalesRows,
        orderDiscountsRaw,
        recentOrdersRaw,
        dailySalesRaw,
        settlementRecord,
      ] = await Promise.all([
        // A. Ventas y check-in por Zona
        this.dataSource
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('t.zone_id', 'zoneId')
          .addSelect('COUNT(t.id)', 'soldCount')
          .addSelect(
            "COUNT(CASE WHEN t.status = 'used' THEN 1 END)",
            'usedCount',
          )
          .addSelect('COALESCE(SUM(t.paid_base_price), 0)', 'grossRevenue')
          .addSelect('COALESCE(SUM(t.paid_service_fee), 0)', 'serviceFeeTotal')
          .where('s.event_id = :eventId', { eventId })
          .andWhere('t.status IN (:...soldStatuses)', {
            soldStatuses: ['sold', 'used'],
          })
          .groupBy('t.zone_id')
          .getRawMany<ZoneSalesRow>(),

        // B. Ventas por Tier
        this.dataSource
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('t.pricing_tier_id', 'pricingTierId')
          .addSelect('COUNT(t.id)', 'soldCount')
          .where('s.event_id = :eventId', { eventId })
          .andWhere('t.pricing_tier_id IS NOT NULL')
          .andWhere('t.status IN (:...soldStatuses)', {
            soldStatuses: ['sold', 'used'],
          })
          .groupBy('t.pricing_tier_id')
          .getRawMany<TierSalesRow>(),

        // C. Ventas y check-in por Show
        this.dataSource
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('t.show_id', 'showId')
          .addSelect('COUNT(t.id)', 'soldCount')
          .addSelect(
            "COUNT(CASE WHEN t.status = 'used' THEN 1 END)",
            'usedCount',
          )
          .where('s.event_id = :eventId', { eventId })
          .andWhere('t.status IN (:...soldStatuses)', {
            soldStatuses: ['sold', 'used'],
          })
          .groupBy('t.show_id')
          .getRawMany<ShowSalesRow>(),

        // D. Descuento total por cupones de órdenes pagadas vinculadas a este evento
        this.dataSource
          .createQueryBuilder(OrderEntity, 'o')
          .leftJoin(TicketEntity, 't', 't.order_id = o.id')
          .leftJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('DISTINCT o.id', 'orderId')
          .addSelect('COALESCE(o.discount_amount, 0)', 'discountAmount')
          .where('o.status = :paidStatus', { paidStatus: 'paid' })
          .andWhere('(o.event_id = :eventId OR s.event_id = :eventId)', {
            eventId,
          })
          .getRawMany<{ orderId: string; discountAmount: string }>(),

        // E. Últimas 25 órdenes pagadas del evento
        this.dataSource
          .createQueryBuilder(OrderEntity, 'o')
          .leftJoinAndSelect('o.user', 'u')
          .leftJoinAndSelect('o.coupon', 'c')
          .leftJoinAndSelect('o.payments', 'p')
          .leftJoinAndSelect('o.tickets', 't')
          .leftJoinAndSelect('t.zone', 'z')
          .leftJoin('t.show', 's')
          .where('o.status = :paidStatus', { paidStatus: 'paid' })
          .andWhere('(o.event_id = :eventId OR s.event_id = :eventId)', {
            eventId,
          })
          .orderBy('o.created_at', 'DESC')
          .take(25)
          .getMany(),

        // F. Ventas por día y por zona (histórico completo desde que se publicaron/vendieron las primeras entradas)
        this.dataSource
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin(ShowEntity, 's', 's.id = t.show_id')
          .innerJoin(OrderEntity, 'o', 'o.id = t.order_id')
          .select("TO_CHAR(o.created_at, 'YYYY-MM-DD')", 'date')
          .addSelect('t.zone_id', 'zoneId')
          .addSelect('COUNT(t.id)', 'ticketsSold')
          .addSelect('COALESCE(SUM(t.paid_base_price), 0)', 'revenue')
          .where('s.event_id = :eventId', { eventId })
          .andWhere('t.status IN (:...soldStatuses)', {
            soldStatuses: ['sold', 'used'],
          })
          .andWhere('o.status = :paidStatus', { paidStatus: 'paid' })
          .groupBy("TO_CHAR(o.created_at, 'YYYY-MM-DD')")
          .addGroupBy('t.zone_id')
          .orderBy('date', 'ASC')
          .getRawMany<DailySalesRow>(),

        // G. Estado de liquidación del evento si ya fue solicitado
        this.dataSource.getRepository(EventSettlementEntity).findOne({
          where: { eventId: String(eventId) },
        }),
      ]);

      // Mapear mapas auxiliares para acceso O(1)
      const zoneSalesMap = new Map<string, ZoneSalesRow>();
      for (const r of zoneSalesRows) {
        zoneSalesMap.set(String(r.zoneId), r);
      }

      const tierSalesMap = new Map<string, number>();
      for (const r of tierSalesRows) {
        tierSalesMap.set(String(r.pricingTierId), Number(r.soldCount) || 0);
      }

      const showSalesMap = new Map<string, ShowSalesRow>();
      for (const r of showSalesRows) {
        showSalesMap.set(String(r.showId), r);
      }

      // Sumar descuentos deduplicando por orderId
      const seenDiscountOrders = new Set<string>();
      let totalCouponsDiscountAmount = 0;
      let totalPaidOrdersCount = 0;

      for (const row of orderDiscountsRaw) {
        if (!row.orderId || seenDiscountOrders.has(row.orderId)) {
          continue;
        }
        seenDiscountOrders.add(row.orderId);
        totalCouponsDiscountAmount += Number(row.discountAmount) || 0;
        totalPaidOrdersCount += 1;
      }
      totalCouponsDiscountAmount =
        Math.round(totalCouponsDiscountAmount * 100) / 100;

      // 2. Mapear Zonas y Tiers
      const sortedZones = [...(event.zones || [])].sort(
        (a, b) => Number(b.regularPrice) - Number(a.regularPrice),
      );

      let totalCapacity = 0;
      let totalTicketsSold = 0;
      let totalTicketsUsed = 0;
      let totalGrossRevenue = 0;
      let totalServiceFee = 0;
      let totalTargetRevenue = 0;

      const hasFeeIncluded = sortedZones.some((z) => z.feeIncluded === true);
      const hasFeeNotIncluded = sortedZones.some(
        (z) => z.feeIncluded === false,
      );
      const feeChargedTo: 'promoter' | 'buyer' | 'mixed' =
        hasFeeIncluded && hasFeeNotIncluded
          ? 'mixed'
          : hasFeeIncluded
            ? 'promoter'
            : 'buyer';

      const mappedZones: OrganizerEventReportZoneDto[] = sortedZones.map(
        (zone) => {
          const zoneCapacity = Number(zone.capacity) || 0;
          const regPrice = Number(zone.regularPrice) || 0;
          const sFee = Number(zone.serviceFee) || 0;

          totalCapacity += zoneCapacity;
          totalTargetRevenue += zoneCapacity * regPrice;

          const metrics = zoneSalesMap.get(String(zone.id));
          const sold = metrics ? Number(metrics.soldCount) || 0 : 0;
          const used = metrics ? Number(metrics.usedCount) || 0 : 0;
          const grossRev = metrics ? Number(metrics.grossRevenue) || 0 : 0;
          const sFeeTot = metrics ? Number(metrics.serviceFeeTotal) || 0 : 0;

          totalTicketsSold += sold;
          totalTicketsUsed += used;
          totalGrossRevenue += grossRev;
          totalServiceFee += sFeeTot;

          const remaining = Math.max(0, zoneCapacity - sold);
          const occupancyPct =
            zoneCapacity > 0
              ? Math.round((sold / zoneCapacity) * 1000) / 10
              : 0;

          // Mapear Tiers de la zona
          const sortedTiers = [...(zone.pricingTiers || [])].sort(
            (a, b) => a.tierNumber - b.tierNumber,
          );

          let activeTierName = 'Precio Regular';
          let activePrice = regPrice;
          let isPresaleActive = false;

          const mappedTiers: OrganizerEventReportTierDto[] = sortedTiers.map(
            (tier) => {
              const tierSold = tierSalesMap.get(String(tier.id)) || 0;
              const tierCap = Number(tier.capacity) || 0;
              const isExpired = tier.endAt ? new Date(tier.endAt) < now : false;
              const isSoldOut = tierCap > 0 && tierSold >= tierCap;
              const isTierActive = Boolean(
                tier.isActive && !isExpired && !isSoldOut,
              );

              let statusBadge = 'Agotado';
              if (isTierActive) {
                statusBadge = 'Activo';
                if (!isPresaleActive) {
                  isPresaleActive = true;
                  activeTierName = tier.name;
                  activePrice = Number(tier.price) || regPrice;
                }
              } else if (isExpired) {
                statusBadge = 'Caducado';
              }

              return {
                tierNumber: tier.tierNumber,
                name: tier.name,
                price: Number(tier.price) || 0,
                capacity: tierCap,
                soldCount: tierSold,
                endAt: tier.endAt ? new Date(tier.endAt).toISOString() : null,
                isActive: isTierActive,
                statusBadge,
              };
            },
          );

          return {
            id: String(zone.id),
            publicUuid: zone.publicUuid,
            name: zone.name,
            color: zone.color || '#6366F1',
            capacity: zoneCapacity,
            soldCount: sold,
            usedCount: used,
            remainingTickets: remaining,
            occupancyPercentage: occupancyPct,
            regularPrice: regPrice,
            activePrice,
            activeTierName,
            isPresaleActive,
            revenue: Math.round(grossRev * 100) / 100,
            feeIncluded: Boolean(zone.feeIncluded),
            serviceFee: sFee,
            tiers: mappedTiers,
          };
        },
      );

      // 3. Mapear Funciones (Shows)
      const sortedShows = [...(event.shows || [])].sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

      const mappedShows: OrganizerEventReportShowDto[] = sortedShows.map(
        (show) => {
          const sMetrics = showSalesMap.get(String(show.id));
          const sSold = sMetrics ? Number(sMetrics.soldCount) || 0 : 0;
          const sUsed = sMetrics ? Number(sMetrics.usedCount) || 0 : 0;

          return {
            id: String(show.id),
            publicUuid: show.publicUuid,
            name: show.name || 'Función Principal',
            startTime: new Date(show.startTime).toISOString(),
            dateFormatted: formatEventDate(new Date(show.startTime)),
            salesEndAt: show.salesEndAt
              ? new Date(show.salesEndAt).toISOString()
              : null,
            durationHours: Number(show.durationHours) || 2,
            status: show.status,
            ticketsSold: sSold,
            ticketsUsed: sUsed,
          };
        },
      );

      // 4. Mapear Órdenes Recientes
      const mappedOrders: OrganizerEventReportRecentOrderDto[] =
        recentOrdersRaw.map((order) => {
          const buyer = order.user;
          const coupon = order.coupon;
          const latestPayment =
            order.payments && order.payments.length > 0
              ? order.payments[order.payments.length - 1]
              : null;

          // Construir resumen de zonas de las entradas en la orden (ej: "2x VIP, 1x General")
          const zoneCounts = new Map<string, number>();
          for (const t of order.tickets || []) {
            const zName = t.zone?.name || 'General';
            zoneCounts.set(zName, (zoneCounts.get(zName) || 0) + 1);
          }
          const zonesSummary =
            Array.from(zoneCounts.entries())
              .map(([zName, count]) => `${count}x ${zName}`)
              .join(', ') || 'Entradas del evento';

          const orderUuidStr = String(order.publicUuid || order.id);
          const orderCode = `#ORD-${orderUuidStr.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

          return {
            id: String(order.id),
            publicUuid: order.publicUuid,
            orderCode,
            createdAt: new Date(order.createdAt).toISOString(),
            buyerName: buyer?.name || 'Cliente Qué Planes Hoy',
            buyerEmail: buyer?.email || 'cliente@queplaneshoy.com',
            ticketsCount: (order.tickets || []).length,
            zonesSummary,
            subtotal: Number(order.subtotalTickets) || 0,
            discountAmount: Number(order.discountAmount) || 0,
            couponCode: coupon?.code || null,
            totalAmount: Number(order.totalAmount) || 0,
            paymentMethod: latestPayment?.paymentMethod || 'Tarjeta / Pasarela',
            status: order.status,
          };
        });

      // 5. Mapear Ventas por Día y por Zona (Timeline histórico completo)
      const zoneMetaMap = new Map<string, { name: string; color: string }>();
      for (const z of event.zones || []) {
        zoneMetaMap.set(String(z.id), {
          name: z.name,
          color: z.color || '#6366F1',
        });
      }

      const dailyMap = new Map<
        string,
        {
          date: string;
          ticketsSold: number;
          revenue: number;
          zones: Array<{
            zoneId: string;
            zoneName: string;
            color: string;
            ticketsSold: number;
            revenue: number;
          }>;
        }
      >();

      for (const row of dailySalesRaw) {
        let entry = dailyMap.get(row.date);
        if (!entry) {
          entry = {
            date: row.date,
            ticketsSold: 0,
            revenue: 0,
            zones: [],
          };
          dailyMap.set(row.date, entry);
        }

        const sold = Number(row.ticketsSold) || 0;
        const rev = Math.round((Number(row.revenue) || 0) * 100) / 100;
        entry.ticketsSold += sold;
        entry.revenue = Math.round((entry.revenue + rev) * 100) / 100;

        const zMeta = zoneMetaMap.get(String(row.zoneId));
        entry.zones.push({
          zoneId: String(row.zoneId),
          zoneName: zMeta?.name || 'Zona',
          color: zMeta?.color || '#6366F1',
          ticketsSold: sold,
          revenue: rev,
        });
      }

      const mappedDailySales: OrganizerEventReportDailySalesDto[] = Array.from(
        dailyMap.values(),
      );

      // 6. Resumen Global (Summary KPIs)
      totalGrossRevenue = Math.round(totalGrossRevenue * 100) / 100;
      totalServiceFee = Math.round(totalServiceFee * 100) / 100;
      const netSalesRevenue = Math.max(
        0,
        Math.round((totalGrossRevenue - totalCouponsDiscountAmount) * 100) /
          100,
      );
      const remainingCapacity = Math.max(0, totalCapacity - totalTicketsSold);
      const globalOccupancyPct =
        totalCapacity > 0
          ? Math.round((totalTicketsSold / totalCapacity) * 1000) / 10
          : 0;
      const checkInPct =
        totalTicketsSold > 0
          ? Math.round((totalTicketsUsed / totalTicketsSold) * 1000) / 10
          : 0;
      const avgTicketPrice =
        totalTicketsSold > 0
          ? Math.round((netSalesRevenue / totalTicketsSold) * 100) / 100
          : 0;
      const targetRevPct =
        totalTargetRevenue > 0
          ? Math.round((netSalesRevenue / totalTargetRevenue) * 1000) / 10
          : 0;

      const summary: OrganizerEventReportSummaryDto = {
        totalCapacity,
        ticketsSold: totalTicketsSold,
        ticketsUsed: totalTicketsUsed,
        ticketsRemaining: remainingCapacity,
        occupancyPercentage: globalOccupancyPct,
        checkInPercentage: checkInPct,
        grossRevenue: totalGrossRevenue,
        totalServiceFee,
        couponsDiscountAmount: totalCouponsDiscountAmount,
        netSalesRevenue,
        averageTicketPrice: avgTicketPrice,
        targetRevenue: totalTargetRevenue,
        targetRevenuePercentage: targetRevPct,
        totalOrdersCount: totalPaidOrdersCount,
      };

      // 7. Meta del Evento
      const flyerImage =
        event.images?.find(
          (img) => img.imageType === 'flyer' || img.imageType === 'banner',
        ) ||
        event.images?.[0] ||
        null;

      const statusMap: Record<string, string> = {
        draft: 'Borrador',
        in_review: 'En Revisión',
        published: 'Publicado',
        observed: 'Observado',
        paused: 'Pausado',
        completed: 'Finalizado',
        cancelled: 'Cancelado',
      };

      const eventCode = `#EV-${event.publicUuid.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
      const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);
      const cityName =
        cityInfo.name && cityInfo.name !== 'Perú'
          ? cityInfo.name
          : event.address || event.venue || 'Lima';

      const settlementStatusLabels: Record<string, string> = {
        requested: 'En Revisión (24h - 72h)',
        in_review: 'En Auditoría Contable',
        approved: 'Aprobado para Pago',
        paid: 'Liquidado y Pagado',
        rejected: 'Observado / Rechazado',
      };

      const mappedEvent: OrganizerEventReportEventDto = {
        id: String(event.id),
        publicUuid: event.publicUuid,
        slug: event.slug,
        name: event.name,
        category: event.category,
        status: event.status,
        statusLabel: statusMap[event.status] || event.status,
        eventCode,
        venue: event.venue,
        address: event.address,
        city: cityName,
        imageUrl: flyerImage?.imageUrl || null,
        hasLandingPage: Boolean(event.hasLandingPage),
        feeChargedTo,
        createdAt: new Date(event.createdAt).toISOString(),
        settlementStatus: settlementRecord?.status || null,
        settlementStatusLabel: settlementRecord
          ? settlementStatusLabels[settlementRecord.status] ||
            settlementRecord.status
          : null,
        settlementAmount: settlementRecord
          ? Number(settlementRecord.netPayoutAmount) || 0
          : null,
        settlementBankName: settlementRecord?.bankName || null,
        settlementRequestedAt: settlementRecord?.requestedAt
          ? new Date(settlementRecord.requestedAt).toISOString()
          : null,
      };

      // 8. Métricas de tráfico, embudo de conversión y UTMs vía Umami Analytics
      const funnel = await this.umamiAnalyticsService.getEventFunnel({
        eventId: String(event.id),
        slug: event.slug,
        createdAt: event.createdAt,
        ordersCount: totalPaidOrdersCount,
        paidOrdersCount: totalPaidOrdersCount,
      });

      const fullReport: OrganizerEventReportResponseDto = {
        event: mappedEvent,
        summary,
        zones: mappedZones,
        shows: mappedShows,
        recentOrders: mappedOrders,
        dailySales: mappedDailySales,
        funnel,
      };

      return ok(
        plainToInstance(OrganizerEventReportResponseDto, fullReport, {
          excludeExtraneousValues: true,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error generando reporte de ventas para evento ${event.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return err('INTERNAL_ERROR');
    }
  }
}
