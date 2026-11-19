import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
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
import { RequestEventSettlementCommand } from '../impl/request-event-settlement.command';
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

@CommandHandler(RequestEventSettlementCommand)
export class RequestEventSettlementHandler
  implements
    ICommandHandler<
      RequestEventSettlementCommand,
      Result<EventSettlementResponseDto, AppError>
    >
{
  private readonly logger = new Logger(RequestEventSettlementHandler.name);

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
    command: RequestEventSettlementCommand,
  ): Promise<Result<EventSettlementResponseDto, AppError>> {
    const { publicUuid, eventIdentifier, dto } = command;

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
        `Usuario ${user.id} intentó solicitar liquidación del evento ${event.id} propiedad de ${event.organizerId}`,
      );
      return err('FORBIDDEN');
    }

    // Verificar si ya existe una liquidación previa
    const existingSettlement = await this.settlementRepository.findOne({
      where: { eventId: String(event.id) },
    });

    if (existingSettlement && existingSettlement.status !== 'rejected') {
      return err('SETTLEMENT_ALREADY_REQUESTED');
    }

    try {
      const eventId = event.id;

      // Consultar números reales y comprobados de taquilla
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

      if (totalSold === 0 || netPayout <= 0) {
        return err('NO_FUNDS_TO_SETTLE');
      }

      const breakdownData = {
        zones: breakdownZones,
        accountType: dto.accountType || 'Ahorros Soles',
        documentType: dto.documentType || 'DNI',
        documentNumber: dto.documentNumber || null,
        requestedNotes: dto.notes || null,
      };

      // Si existía una previa rechazada, reutilizamos su ID o creamos una nueva
      let settlement = existingSettlement;
      if (!settlement) {
        settlement = this.settlementRepository.create({
          eventId: String(event.id),
          organizerId: user.id,
        });
      }

      settlement.status = 'requested';
      settlement.totalTicketsSold = totalSold;
      settlement.grossAmount = totalGross;
      settlement.totalCouponsDiscountAmount = totalCouponsDiscount;
      settlement.platformFeeAmount = totalFee;
      settlement.gatewayFeeAmount = 0;
      settlement.totalAdvancesAmount = 0;
      settlement.adjustmentsAmount = 0;
      settlement.netPayoutAmount = netPayout;
      settlement.bankName = dto.bankName.trim();
      settlement.bankAccountNumber = dto.accountNumber.trim();
      settlement.bankAccountCci = dto.accountCci.trim();
      settlement.bankAccountHolder = dto.accountHolder.trim();
      settlement.notes = dto.notes ? dto.notes.trim() : null;
      settlement.breakdownByZone = breakdownData;
      settlement.requestedAt = new Date();

      const saved = await this.settlementRepository.save(settlement);

      const eventCode = `#EV-${event.publicUuid.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

      const responseDto: EventSettlementResponseDto = {
        publicUuid: saved.publicUuid,
        eventId: String(event.id),
        eventTitle: event.name,
        eventCode,
        status: saved.status,
        statusLabel: SETTLEMENT_STATUS_LABELS[saved.status] || saved.status,
        isSettlementRequested: true,
        totalTicketsSold: Number(saved.totalTicketsSold) || 0,
        grossAmount: Number(saved.grossAmount) || 0,
        totalCouponsDiscountAmount: Number(saved.totalCouponsDiscountAmount) || 0,
        platformFeeAmount: Number(saved.platformFeeAmount) || 0,
        gatewayFeeAmount: Number(saved.gatewayFeeAmount) || 0,
        totalAdvancesAmount: Number(saved.totalAdvancesAmount) || 0,
        adjustmentsAmount: Number(saved.adjustmentsAmount) || 0,
        netPayoutAmount: Number(saved.netPayoutAmount) || 0,
        bankName: saved.bankName,
        bankAccountNumber: saved.bankAccountNumber,
        bankAccountCci: saved.bankAccountCci,
        bankAccountHolder: saved.bankAccountHolder,
        accountType: dto.accountType || null,
        documentType: dto.documentType || null,
        documentNumber: dto.documentNumber || null,
        transferReference: saved.transferReference,
        transferVoucherUrl: saved.transferVoucherUrl,
        requestedAt: saved.requestedAt ? new Date(saved.requestedAt).toISOString() : null,
        paidAt: saved.paidAt ? new Date(saved.paidAt).toISOString() : null,
        notes: saved.notes,
        breakdownByZone: breakdownZones,
      };

      return ok(
        plainToInstance(EventSettlementResponseDto, responseDto, {
          excludeExtraneousValues: true,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error procesando solicitud de liquidación para evento ${event.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return err('INTERNAL_ERROR');
    }
  }
}
