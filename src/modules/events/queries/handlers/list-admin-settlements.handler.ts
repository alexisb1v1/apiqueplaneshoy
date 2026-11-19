import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { EventSettlementEntity } from '../../domain/entities/event-settlement.entity';
import { ListAdminSettlementsQuery } from '../impl/list-admin-settlements.query';
import {
  AdminSettlementItemDto,
  AdminSettlementListResponseDto,
} from '../../dto/admin-settlement-list.response.dto';

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  requested: 'En Revisión (24h - 72h)',
  in_review: 'En Auditoría Contable',
  approved: 'Aprobado para Pago',
  paid: 'Liquidado y Pagado',
  rejected: 'Observado / Rechazado',
};

@QueryHandler(ListAdminSettlementsQuery)
export class ListAdminSettlementsHandler
  implements
    IQueryHandler<
      ListAdminSettlementsQuery,
      Result<AdminSettlementListResponseDto, AppError>
    >
{
  constructor(
    @InjectRepository(EventSettlementEntity)
    private readonly settlementRepository: Repository<EventSettlementEntity>,
  ) {}

  async execute(
    query: ListAdminSettlementsQuery,
  ): Promise<Result<AdminSettlementListResponseDto, AppError>> {
    const { status, search } = query;

    const qb = this.settlementRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.event', 'e')
      .leftJoinAndSelect('s.organizer', 'u')
      .orderBy('s.requested_at', 'DESC');

    if (status && status !== 'all') {
      qb.andWhere('s.status = :status', { status });
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(e.name) LIKE :term OR LOWER(u.organizer_name) LIKE :term OR u.organizer_document_number LIKE :term OR LOWER(s.bank_account_holder) LIKE :term)',
        { term },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    const now = new Date().getTime();

    const items: AdminSettlementItemDto[] = rows.map((s) => {
      const event = s.event;
      const organizer = s.organizer;
      const breakdown = (s.breakdownByZone || {}) as Record<string, any>;

      const reqTime = s.requestedAt ? new Date(s.requestedAt).getTime() : now;
      const hoursElapsed = Math.round(((now - reqTime) / (1000 * 60 * 60)) * 10) / 10;

      const code = `#LIQ-${(s.publicUuid || '').replace(/-/g, '').substring(0, 8).toUpperCase()}`;
      const eventCode = event
        ? `#EV-${(event.publicUuid || '').replace(/-/g, '').substring(0, 8).toUpperCase()}`
        : '';

      return {
        id: String(s.id),
        publicUuid: s.publicUuid,
        code,
        eventId: String(s.eventId),
        eventTitle: event?.name || 'Evento Desconocido',
        eventCode,
        eventStatus: event?.status || '',
        organizerId: s.organizerId,
        organizerName:
          organizer?.organizerName || s.bankAccountHolder || organizer?.name || 'Organizador',
        organizerDocumentType:
          breakdown.documentType || organizer?.organizerDocumentType || 'RUC',
        organizerDocumentNumber:
          breakdown.documentNumber || organizer?.organizerDocumentNumber || '',
        bankName: s.bankName || 'BCP',
        bankAccountNumber: s.bankAccountNumber || '',
        bankAccountCci: s.bankAccountCci || null,
        bankAccountHolder: s.bankAccountHolder || '',
        accountType: breakdown.accountType || 'Ahorros Soles',
        totalTicketsSold: Number(s.totalTicketsSold) || 0,
        grossAmount: Number(s.grossAmount) || 0,
        totalCouponsDiscountAmount: Number(s.totalCouponsDiscountAmount) || 0,
        platformFeeAmount: Number(s.platformFeeAmount) || 0,
        netPayoutAmount: Number(s.netPayoutAmount) || 0,
        status: s.status,
        statusLabel: SETTLEMENT_STATUS_LABELS[s.status] || s.status,
        requestedAt: s.requestedAt ? new Date(s.requestedAt).toISOString() : new Date().toISOString(),
        paidAt: s.paidAt ? new Date(s.paidAt).toISOString() : null,
        transferReference: s.transferReference,
        transferVoucherUrl: s.transferVoucherUrl,
        notes: s.notes,
        hoursElapsed,
      };
    });

    const response: AdminSettlementListResponseDto = {
      items,
      total,
    };

    return ok(
      plainToInstance(AdminSettlementListResponseDto, response, {
        excludeExtraneousValues: true,
      }),
    );
  }
}
