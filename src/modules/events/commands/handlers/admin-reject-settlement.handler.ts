import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { AppError } from '@common/errors/app-errors';
import { EventSettlementEntity } from '../../domain/entities/event-settlement.entity';
import { AdminRejectSettlementCommand } from '../impl/admin-reject-settlement.command';

@CommandHandler(AdminRejectSettlementCommand)
export class AdminRejectSettlementHandler
  implements
    ICommandHandler<AdminRejectSettlementCommand, Result<EventSettlementEntity, AppError>>
{
  private readonly logger = new Logger(AdminRejectSettlementHandler.name);

  constructor(
    @InjectRepository(EventSettlementEntity)
    private readonly settlementRepository: Repository<EventSettlementEntity>,
  ) {}

  async execute(
    command: AdminRejectSettlementCommand,
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
      settlement.status = 'rejected';
      settlement.notes = dto.reason.trim();
      settlement.processedByUserId = adminUserId;

      const saved = await this.settlementRepository.save(settlement);

      this.logger.log(
        `Liquidación ${saved.id} OBSERVADA/RECHAZADA por admin ${adminUserId}. Motivo: ${dto.reason}`,
      );

      return ok(saved);
    } catch (error) {
      this.logger.error(
        `Error al rechazar liquidación ${settlement.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return err('INTERNAL_ERROR');
    }
  }
}
