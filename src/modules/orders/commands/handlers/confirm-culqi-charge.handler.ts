import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { ConfirmCulqiChargeCommand } from '../impl/confirm-culqi-charge.command';
import { ConfirmCulqiChargeResponseDto } from '../../dto/confirm-culqi-charge.response.dto';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { CulqiGatewayService } from '@orders/infrastructure/gateways/culqi-gateway.service';
import { OrderLifecycleService } from '../../application/services/order-lifecycle.service';

function extractNameParts(fullName?: string | null): { firstName: string; lastName: string } {
  const cleaned = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { firstName: 'Cliente', lastName: 'QPH' };
  const parts = cleaned.split(' ');
  const firstName = parts[0] || 'Cliente';
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
}

function extractLocalNineDigitPhone(rawPhone?: string | null): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) return digits;
  if (digits.length === 11 && digits.startsWith('519')) return digits.slice(2);
  return '999999999';
}

@CommandHandler(ConfirmCulqiChargeCommand)
export class ConfirmCulqiChargeHandler
  implements
    ICommandHandler<ConfirmCulqiChargeCommand, Result<ConfirmCulqiChargeResponseDto, AppError>>
{
  private readonly logger = new Logger(ConfirmCulqiChargeHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketRepository: Repository<TicketEntity>,
    private readonly culqiGatewayService: CulqiGatewayService,
    private readonly orderLifecycleService: OrderLifecycleService,
  ) {}

  /**
   * Procesa el cobro definitivo contra Culqi API v2 (`POST /v2/charges`) con validación antifraude y soporte 3DS.
   *
   * @param command - Token generado en Culqi Checkout v4 y UUID de la orden reservada
   * @returns Confirmación de pago con boletos emitidos o requerimiento de autenticación 3DS
   */
  async execute(
    command: ConfirmCulqiChargeCommand,
  ): Promise<Result<ConfirmCulqiChargeResponseDto, AppError>> {
    const { dto, authenticatedUserId } = command;

    if (!this.culqiGatewayService.isConfigured()) {
      return err('GATEWAY_NOT_CONFIGURED');
    }

    if (!authenticatedUserId) {
      return err('UNAUTHORIZED');
    }

    const order = await this.orderRepository.findOne({
      where: { publicUuid: dto.orderPublicUuid },
      relations: { user: true, coupon: true },
    });

    if (!order) {
      return err('NOT_FOUND');
    }

    // Protección BOLA (OWASP API1): validar pertenencia de la orden al comprador autenticado
    if (Number(order.userId) !== Number(authenticatedUserId)) {
      return err('FORBIDDEN');
    }

    if (order.status === 'paid') {
      const idempotentResult = await this.orderLifecycleService.finalizePaidOrder({
        orderIdOrUuid: order.publicUuid,
        paymentMethod: dto.paymentMethod || 'card',
        externalTransactionId: dto.tokenId,
        gatewayResponse: { provider: 'culqi' },
      });

      if (idempotentResult.isErr()) {
        return err(idempotentResult.error);
      }

      return ok(
        plainToInstance(
          ConfirmCulqiChargeResponseDto,
          {
            status: 'PAID',
            requires3DS: false,
            orderPublicUuid: order.publicUuid,
            tokenId: dto.tokenId,
            checkoutResult: idempotentResult.value,
          },
          { excludeExtraneousValues: true },
        ),
      );
    }

    if (order.status !== 'pending' || new Date() > new Date(order.expiresAt)) {
      if (order.status === 'pending') {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          await this.orderLifecycleService.releasePendingOrder(
            queryRunner.manager,
            order.id,
            'expired',
          );
          await queryRunner.commitTransaction();
        } catch {
          await queryRunner.rollbackTransaction();
        } finally {
          await queryRunner.release();
        }
      }
      return err('ORDER_EXPIRED');
    }

    // Revalidar cupón antes de efectuar cualquier cobro en tarjeta/Yape
    if (order.couponId && order.coupon) {
      const sampleTicket = await this.ticketRepository.findOne({
        where: { orderId: order.id },
        relations: { show: true },
      });
      if (sampleTicket?.show?.eventId) {
        const couponCheck = await this.orderLifecycleService.evaluateCoupon(
          this.dataSource.manager,
          sampleTicket.show.eventId,
          order.coupon.code,
          Number(order.subtotalTickets),
          { lockForUpdate: false, consumeNow: false },
        );
        if (couponCheck.isErr()) {
          return err(couponCheck.error);
        }
      }
    }

    const pendingPayment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
      order: { id: 'DESC' },
    });

    const culqiOrderId =
      (pendingPayment?.gatewayResponse?.culqiOrderId as string | undefined) ||
      (pendingPayment?.externalTransactionId?.startsWith('ord_')
        ? pendingPayment.externalTransactionId
        : undefined);

    const { firstName, lastName } = extractNameParts(order.user?.name);
    const localPhone = extractLocalNineDigitPhone(order.user?.organizerPhone);
    const amountInCents = Math.round(Number(order.totalAmount) * 100);
    const resolvedMethod = dto.paymentMethod || pendingPayment?.paymentMethod || 'card';

    const chargeResult = await this.culqiGatewayService.createCharge({
      amount: amountInCents,
      currencyCode: 'PEN',
      email: order.user.email,
      sourceId: dto.tokenId,
      description: `Orden QPH #${order.id}`,
      installments: dto.installments,
      antifraudDetails: {
        firstName,
        lastName,
        address: 'Lima, Peru',
        addressCity: 'Lima',
        countryCode: 'PE',
        phoneNumber: localPhone,
        deviceFingerPrintId: dto.deviceFingerPrintId,
      },
      authentication3DS: dto.authentication3DS,
      metadata: {
        qph_order_id: String(order.id),
        qph_order_uuid: order.publicUuid,
        qph_user_id: String(order.userId),
        ...(order.user?.publicUuid ? { qph_user_uuid: order.user.publicUuid } : {}),
        ...(order.user?.email ? { qph_user_email: order.user.email.slice(0, 100) } : {}),
        ...(culqiOrderId ? { culqi_order_id: culqiOrderId } : {}),
      },
    });

    if (chargeResult.status === 'REQUIRES_3DS') {
      return ok(
        plainToInstance(
          ConfirmCulqiChargeResponseDto,
          {
            status: 'REQUIRES_3DS',
            requires3DS: true,
            orderPublicUuid: order.publicUuid,
            tokenId: dto.tokenId,
            checkoutResult: null,
          },
          { excludeExtraneousValues: true },
        ),
      );
    }

    if (chargeResult.status === 'REJECTED') {
      if (pendingPayment) {
        pendingPayment.gatewayResponse = {
          ...(pendingPayment.gatewayResponse || {}),
          lastRejectedAttemptAt: new Date().toISOString(),
          lastRejectMessage: chargeResult.message,
        };
        await this.paymentRepository.save(pendingPayment);
      }
      return err('PAYMENT_REJECTED');
    }

    if (chargeResult.status === 'GATEWAY_ERROR') {
      return err('GATEWAY_ERROR');
    }

    const detectedPaymentMethod =
      chargeResult.charge.source?.object === 'yape' || dto.tokenId.startsWith('ype_')
        ? 'yape'
        : resolvedMethod;

    const finalized = await this.orderLifecycleService.finalizePaidOrder({
      orderIdOrUuid: order.publicUuid,
      paymentMethod: detectedPaymentMethod,
      externalTransactionId: chargeResult.charge.id,
      gatewayResponse: {
        provider: 'culqi',
        culqiOrderId: culqiOrderId || null,
        culqiChargeId: chargeResult.charge.id,
        culqiCharge: chargeResult.charge,
      },
      successMessage: '¡Pago confirmado exitosamente con Culqi!',
    });

    if (finalized.isErr()) {
      this.logger.error(
        `Cargo aprobado (${chargeResult.charge.id}) pero falló finalización local de orden ${order.publicUuid}: ${finalized.error}`,
      );
      return err(finalized.error);
    }

    return ok(
      plainToInstance(
        ConfirmCulqiChargeResponseDto,
        {
          status: 'PAID',
          requires3DS: false,
          orderPublicUuid: order.publicUuid,
          tokenId: dto.tokenId,
          checkoutResult: finalized.value,
        },
        { excludeExtraneousValues: true },
      ),
    );
  }
}

