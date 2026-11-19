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
import { UserEntity } from '@users/domain/entities/user.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { EventSettlementEntity } from '../../domain/entities/event-settlement.entity';
import { GetEventSettlementQuery } from '../impl/get-event-settlement.query';
import {
  EventSettlementResponseDto,
  SettlementBreakdownZoneDto,
} from '../../dto/event-settlement.response.dto';

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  requested: 'En Revisión (24h - 72h)',
  in_review: 'En Auditoría Contable',
  approved: 'Aprobado para Pago',
  paid: 'Liquidado y Pagado',
  rejected: 'Observado / Rechazado',
};

@QueryHandler(GetEventSettlementQuery)
export class GetEventSettlementHandler
  implements
    IQueryHandler<
      GetEventSettlementQuery,
      Result<EventSettlementResponseDto, AppError>
    >
{
  private readonly logger = new Logger(GetEventSettlementHandler.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventSettlementEntity)
    private readonly settlementRepository: Repository<EventSettlementEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async execute(
    query: GetEventSettlementQuery,
  ): Promise<Result<EventSettlementResponseDto, AppError>> {
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

    if (!user.isOrganizer || (user.role !== 'customer' && user.role !== 'admin')) {
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
        zones: true,
      },
    });

    if (!event) {
      return err('NOT_FOUND');
    }

    // Validación BOLA (Ownership)
    if (Number(event.organizerId) !== Number(user.id)) {
      this.logger.warn(
        `Usuario ${user.id} intentó acceder a la liquidación del evento ${event.id} propiedad de ${event.organizerId}`,
      );
      return err('FORBIDDEN');
    }

    const eventCode = `#EV-${event.publicUuid.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

    // 1. Revisar si ya existe liquidación en la tabla event_settlements
    const existingSettlement = await this.settlementRepository.findOne({
      where: { eventId: String(event.id) },
    });

    if (existingSettlement) {
      const breakdown = (existingSettlement.breakdownByZone || {}) as Record<string, any>;
      const rawZones = Array.isArray(breakdown.zones) ? breakdown.zones : [];

      const dto: EventSettlementResponseDto = {
        publicUuid: existingSettlement.publicUuid,
        eventId: String(event.id),
        eventTitle: event.name,
        eventCode,
        status: existingSettlement.status,
        statusLabel:
          SETTLEMENT_STATUS_LABELS[existingSettlement.status] || existingSettlement.status,
        isSettlementRequested: true,
        totalTicketsSold: Number(existingSettlement.totalTicketsSold) || 0,
        grossAmount: Number(existingSettlement.grossAmount) || 0,
        totalCouponsDiscountAmount:
          Number(existingSettlement.totalCouponsDiscountAmount) || 0,
        platformFeeAmount: Number(existingSettlement.platformFeeAmount) || 0,
        gatewayFeeAmount: Number(existingSettlement.gatewayFeeAmount) || 0,
        totalAdvancesAmount: Number(existingSettlement.totalAdvancesAmount) || 0,
        adjustmentsAmount: Number(existingSettlement.adjustmentsAmount) || 0,
        netPayoutAmount: Number(existingSettlement.netPayoutAmount) || 0,
        bankName: existingSettlement.bankName,
        bankAccountNumber: existingSettlement.bankAccountNumber,
        bankAccountCci: existingSettlement.bankAccountCci,
        bankAccountHolder: existingSettlement.bankAccountHolder,
        accountType: breakdown.accountType || null,
        documentType: breakdown.documentType || null,
        documentNumber: breakdown.documentNumber || null,
        transferReference: existingSettlement.transferReference,
        transferVoucherUrl: existingSettlement.transferVoucherUrl,
        requestedAt: existingSettlement.requestedAt
          ? new Date(existingSettlement.requestedAt).toISOString()
          : null,
        paidAt: existingSettlement.paidAt
          ? new Date(existingSettlement.paidAt).toISOString()
          : null,
        notes: existingSettlement.notes,
        breakdownByZone: rawZones,
      };

      return ok(
        plainToInstance(EventSettlementResponseDto, dto, {
          excludeExtraneousValues: true,
        }),
      );
    }

    // 2. Si no existe, precalcular los números en tiempo real para que el promotor vea la simulación
    try {
      const eventId = event.id;

      const [zoneSalesRows, orderDiscountsRaw] = await Promise.all([
        this.dataSource
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('t.zone_id', 'zoneId')
          .addSelect('COUNT(t.id)', 'soldCount')
          .addSelect('COALESCE(SUM(t.paid_base_price), 0)', 'grossRevenue')
          .addSelect('COALESCE(SUM(t.paid_service_fee), 0)', 'serviceFeeTotal')
          .where('s.event_id = :eventId', { eventId })
          .andWhere('t.status IN (:...soldStatuses)', { soldStatuses: ['sold', 'used'] })
          .groupBy('t.zone_id')
          .getRawMany<{
            zoneId: string;
            soldCount: string;
            grossRevenue: string;
            serviceFeeTotal: string;
          }>(),

        this.dataSource
          .createQueryBuilder(OrderEntity, 'o')
          .leftJoin(TicketEntity, 't', 't.order_id = o.id')
          .leftJoin(ShowEntity, 's', 's.id = t.show_id')
          .select('DISTINCT o.id', 'orderId')
          .addSelect('COALESCE(o.discount_amount, 0)', 'discountAmount')
          .where('o.status = :paidStatus', { paidStatus: 'paid' })
          .andWhere('(o.event_id = :eventId OR s.event_id = :eventId)', { eventId })
          .getRawMany<{ orderId: string; discountAmount: string }>(),
      ]);

      const seenOrders = new Set<string>();
      let totalCouponsDiscount = 0;
      for (const row of orderDiscountsRaw) {
        if (!row.orderId || seenOrders.has(row.orderId)) continue;
        seenOrders.add(row.orderId);
        totalCouponsDiscount += Number(row.discountAmount) || 0;
      }
      totalCouponsDiscount = Math.round(totalCouponsDiscount * 100) / 100;

      let totalSold = 0;
      let totalGross = 0;
      let totalFee = 0;

      const zoneMap = new Map<string, { name: string }>();
      for (const z of event.zones || []) {
        zoneMap.set(String(z.id), { name: z.name });
      }

      const breakdownZones: SettlementBreakdownZoneDto[] = zoneSalesRows.map((r) => {
        const sold = Number(r.soldCount) || 0;
        const rev = Math.round((Number(r.grossRevenue) || 0) * 100) / 100;
        const fee = Math.round((Number(r.serviceFeeTotal) || 0) * 100) / 100;

        totalSold += sold;
        totalGross += rev;
        totalFee += fee;

        return {
          zoneId: String(r.zoneId),
          zoneName: zoneMap.get(String(r.zoneId))?.name || 'Zona',
          ticketsSold: sold,
          revenue: rev,
          serviceFee: fee,
        };
      });

      totalGross = Math.round(totalGross * 100) / 100;
      totalFee = Math.round(totalFee * 100) / 100;
      const netPayout = Math.max(0, Math.round((totalGross - totalCouponsDiscount - totalFee) * 100) / 100);

      const simulationDto: EventSettlementResponseDto = {
        publicUuid: '',
        eventId: String(event.id),
        eventTitle: event.name,
        eventCode,
        status: 'draft',
        statusLabel: 'Disponible para Liquidación',
        isSettlementRequested: false,
        totalTicketsSold: totalSold,
        grossAmount: totalGross,
        totalCouponsDiscountAmount: totalCouponsDiscount,
        platformFeeAmount: totalFee,
        gatewayFeeAmount: 0,
        totalAdvancesAmount: 0,
        adjustmentsAmount: 0,
        netPayoutAmount: netPayout,
        bankName: null,
        bankAccountNumber: null,
        bankAccountCci: null,
        bankAccountHolder: null,
        accountType: null,
        documentType: null,
        documentNumber: null,
        transferReference: null,
        transferVoucherUrl: null,
        requestedAt: null,
        paidAt: null,
        notes: null,
        breakdownByZone: breakdownZones,
      };

      return ok(
        plainToInstance(EventSettlementResponseDto, simulationDto, {
          excludeExtraneousValues: true,
        }),
      );
    } catch (errCalc) {
      this.logger.error(
        `Error calculando resumen de liquidación para evento ${event.id}: ${(errCalc as Error).message}`,
      );
      return err('INTERNAL_ERROR');
    }
  }
}
