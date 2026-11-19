import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { AppError } from '@common/errors/app-errors';
import { EventSettlementEntity } from '../../domain/entities/event-settlement.entity';
import { AdminPaySettlementCommand } from '../impl/admin-pay-settlement.command';

@CommandHandler(AdminPaySettlementCommand)
export class AdminPaySettlementHandler
  implements ICommandHandler<AdminPaySettlementCommand, Result<EventSettlementEntity, AppError>>
{
  private readonly logger = new Logger(AdminPaySettlementHandler.name);

  constructor(
    @InjectRepository(EventSettlementEntity)
    private readonly settlementRepository: Repository<EventSettlementEntity>,
  ) {}

  async execute(
    command: AdminPaySettlementCommand,
  ): Promise<Result<EventSettlementEntity, AppError>> {
    const { settlementIdentifier, dto, adminUserId } = command;

    const isNumeric = /^\d+$/.test(settlementIdentifier);
    let whereClause: Record<string, any>;
    if (isNumeric) {
      whereClause = { id: settlementIdentifier };
    } else {
      whereClause = { publicUuid: settlementIdentifier };
    }

    const settlement = await this.settlementRepository.findOne({
      where: whereClause,
      relations: {
        event: true,
        organizer: true,
      },
    });

    if (!settlement) {
      return err('NOT_FOUND');
    }

    try {
      settlement.status = 'paid';
      settlement.paidAt = new Date();
      settlement.transferReference = dto.transferReference.trim();
      if (dto.transferVoucherUrl && dto.transferVoucherUrl.trim() !== '') {
        settlement.transferVoucherUrl = dto.transferVoucherUrl.trim();
      }
      settlement.processedByUserId = adminUserId;
      if (dto.notes && dto.notes.trim() !== '') {
        settlement.notes = settlement.notes
          ? `${settlement.notes} | Admin: ${dto.notes.trim()}`
          : dto.notes.trim();
      }

      const saved = await this.settlementRepository.save(settlement);

      this.logger.log(
        `Liquidación ${saved.id} (Evento: ${saved.eventId}) marcada como PAGADA por el admin ${adminUserId}. Ref: ${saved.transferReference}`,
      );

      return ok(saved);
    } catch (error) {
      this.logger.error(
        `Error al marcar como pagada la liquidación ${settlement.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return err('INTERNAL_ERROR');
    }
  }
}
