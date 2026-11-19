import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { AppError } from '@common/errors/app-errors';
import { EventSettlementEntity } from '../../domain/entities/event-settlement.entity';
import { AdminPaySettlementCommand } from '../impl/admin-pay-settlement.command';
import { MailService } from '@modules/mail/mail.service';
import { EmailAttachment } from '@modules/mail/mail.types';

@CommandHandler(AdminPaySettlementCommand)
export class AdminPaySettlementHandler
  implements ICommandHandler<AdminPaySettlementCommand, Result<EventSettlementEntity, AppError>>
{
  private readonly logger = new Logger(AdminPaySettlementHandler.name);

  constructor(
    @InjectRepository(EventSettlementEntity)
    private readonly settlementRepository: Repository<EventSettlementEntity>,
    private readonly mailService: MailService,
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

      // Notificar al organizador con el detalle de la liquidación y adjunto del voucher
      const organizerEmail = settlement.organizer?.email;
      if (organizerEmail) {
        (async () => {
          let attachments: EmailAttachment[] = [];
          if (saved.transferVoucherUrl) {
            try {
              const voucherRes = await fetch(saved.transferVoucherUrl);
              if (voucherRes.ok) {
                const arrayBuffer = await voucherRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const contentType = voucherRes.headers.get('content-type') || 'image/webp';
                const extension = contentType.includes('png')
                  ? 'png'
                  : contentType.includes('pdf')
                  ? 'pdf'
                  : contentType.includes('jpeg') || contentType.includes('jpg')
                  ? 'jpg'
                  : 'webp';

                attachments.push({
                  filename: `voucher-liquidacion-${saved.transferReference}.${extension}`,
                  content: buffer.toString('base64'),
                  contentType,
                });
              }
            } catch (fetchErr) {
              this.logger.warn(`No se pudo descargar el voucher para adjuntarlo al correo: ${(fetchErr as Error).message}`);
            }
          }

          await this.mailService.sendSettlementPaidEmail({
            to: organizerEmail,
            name: settlement.organizer?.name || settlement.organizer?.organizerName || 'Organizador',
            eventTitle: settlement.event?.name || 'Evento',
            totalTicketsSold: Number(saved.totalTicketsSold) || 0,
            grossAmountFormatted: `S/ ${Number(saved.grossAmount || 0).toFixed(2)}`,
            couponsDiscountFormatted: `S/ ${Number(saved.totalCouponsDiscountAmount || 0).toFixed(2)}`,
            platformFeeFormatted: `S/ ${Number(saved.platformFeeAmount || 0).toFixed(2)}`,
            gatewayFeeFormatted: `S/ ${Number(saved.gatewayFeeAmount || 0).toFixed(2)}`,
            advancesDeductedFormatted: `S/ ${Number(saved.totalAdvancesAmount || 0).toFixed(2)}`,
            adjustmentsFormatted: `S/ ${Number(saved.adjustmentsAmount || 0).toFixed(2)}`,
            netPayoutFormatted: `S/ ${Number(saved.netPayoutAmount || 0).toFixed(2)}`,
            bankName: saved.bankName || 'No especificado',
            transferReference: saved.transferReference || '-',
            paidAtIso: saved.paidAt ? new Date(saved.paidAt).toISOString() : new Date().toISOString(),
            voucherUrl: saved.transferVoucherUrl,
            attachments: attachments.length > 0 ? attachments : undefined,
          });
        })().catch((mailErr) => {
          this.logger.warn(`No se pudo enviar el correo de liquidación pagada a ${organizerEmail}: ${(mailErr as Error).message}`);
        });
      }

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
