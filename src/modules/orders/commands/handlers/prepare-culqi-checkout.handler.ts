import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { PrepareCulqiCheckoutCommand } from '../impl/prepare-culqi-checkout.command';
import { PrepareCulqiCheckoutResponseDto } from '../../dto/prepare-culqi-checkout.response.dto';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ZonePricingTierEntity } from '@events/domain/entities/zone-pricing-tier.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { CulqiGatewayService } from '@orders/infrastructure/gateways/culqi-gateway.service';
import {
  OrderLifecycleService,
  resolveZoneTicketPricing,
} from '../../application/services/order-lifecycle.service';

interface ResolvedZoneLine {
  zone: ZoneEntity;
  tier: ZonePricingTierEntity | null;
  unitBasePrice: number;
  unitServiceFee: number;
  unitBuyerPrice: number;
  quantity: number;
}

function splitFullName(fullName?: string | null): { firstName: string; lastName: string } {
  const cleaned = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { firstName: 'Cliente', lastName: 'QPH' };
  const parts = cleaned.split(' ');
  const firstName = parts[0] || 'Cliente';
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
}

function normalizePeruPhone(rawPhone?: string | null): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) {
    return `+51${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('519')) {
    return `+${digits}`;
  }
  return '+51999999999';
}

@CommandHandler(PrepareCulqiCheckoutCommand)
export class PrepareCulqiCheckoutHandler
  implements
    ICommandHandler<PrepareCulqiCheckoutCommand, Result<PrepareCulqiCheckoutResponseDto, AppError>>
{
  private readonly logger = new Logger(PrepareCulqiCheckoutHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly culqiGatewayService: CulqiGatewayService,
    private readonly orderLifecycleService: OrderLifecycleService,
  ) {}

  /**
   * Reserva stock de forma atómica en PostgreSQL y crea la orden correspondiente en Culqi API v2.
   *
   * @param command - Datos de entradas seleccionadas y usuario autenticado
   * @returns Configuración lista para abrir Culqi Checkout v4 o error tipado `AppError`
   */
  async execute(
    command: PrepareCulqiCheckoutCommand,
  ): Promise<Result<PrepareCulqiCheckoutResponseDto, AppError>> {
    const { dto, authenticatedUserId } = command;

    if (!this.culqiGatewayService.isConfigured()) {
      return err('GATEWAY_NOT_CONFIGURED');
    }

    if (!authenticatedUserId) {
      return err('UNAUTHORIZED');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(UserEntity, {
        where: { id: authenticatedUserId },
      });

      if (!user) {
        await queryRunner.rollbackTransaction();
        return err('UNAUTHORIZED');
      }

      const event = await this.orderLifecycleService.findEventByIdentifier(
        queryRunner.manager,
        dto.eventId,
      );
      if (!event) {
        this.logger.warn(`[Culqi Prepare] Evento no encontrado para eventId='${dto.eventId}'.`);
        await queryRunner.rollbackTransaction();
        return err('EVENT_NOT_FOUND');
      }

      let show = await this.orderLifecycleService.findShowByIdentifier(
        queryRunner.manager,
        dto.showId,
        event.id,
      );
      // Fallback seguro si el cliente conservó el identificador por defecto 'f1'
      if (!show && (dto.showId === 'f1' || !dto.showId?.trim())) {
        show = await queryRunner.manager.findOne(ShowEntity, {
          where: { eventId: event.id },
          order: { startTime: 'ASC', id: 'ASC' },
        });
      }
      if (!show) {
        this.logger.warn(
          `[Culqi Prepare] Función no encontrada: showId='${dto.showId}' en evento id=${event.id} (${event.publicUuid}).`,
        );
        await queryRunner.rollbackTransaction();
        return err('SHOW_NOT_FOUND');
      }

      const totalOrderTickets = (dto.items || []).reduce(
        (acc, curr) => acc + (Number(curr.quantity) || 0),
        0,
      );
      if (totalOrderTickets <= 0) {
        await queryRunner.rollbackTransaction();
        return err('INVALID_INPUT');
      }

      // Liberar cualquier orden pendiente previa abandonada por el mismo usuario en este evento
      const previousPendingOrders = await queryRunner.manager
        .createQueryBuilder(OrderEntity, 'o')
        .innerJoin('o.tickets', 't')
        .innerJoin('t.show', 's')
        .where('s.eventId = :eventId', { eventId: event.id })
        .andWhere('o.userId = :userId', { userId: user.id })
        .andWhere('o.status = :pendingStatus', { pendingStatus: 'pending' })
        .select(['o.id', 'o.publicUuid'])
        .distinct(true)
        .getMany();

      for (const prevOrder of previousPendingOrders) {
        await this.orderLifecycleService.releasePendingOrder(
          queryRunner.manager,
          prevOrder.id,
          'cancelled',
        );
      }

      // Validar tope global acumulado por usuario en el evento (Regla 1: Por Evento)
      const eventTicketLimit = Number(event.userTicketLimit) || 6;
      const now = new Date();

      const userBoughtTicketsCount = await queryRunner.manager
        .createQueryBuilder(TicketEntity, 't')
        .innerJoin('t.order', 'o')
        .innerJoin('t.show', 's')
        .where('s.eventId = :eventId', { eventId: event.id })
        .andWhere('o.userId = :userId', { userId: user.id })
        .andWhere('(o.status = :paidStatus OR (o.status = :pendingStatus AND o.expiresAt > :now))', {
          paidStatus: 'paid',
          pendingStatus: 'pending',
          now,
        })
        .andWhere('t.status IN (:...ticketStatuses)', {
          ticketStatuses: ['sold', 'used', 'locked'],
        })
        .getCount();

      if (userBoughtTicketsCount + totalOrderTickets > eventTicketLimit) {
        await queryRunner.rollbackTransaction();
        return err('TICKET_LIMIT_EXCEEDED');
      }

      // Bloquear y validar zonas, preventas y límites por orden (Regla 2: Por Orden)
      let subtotalTickets = 0;
      let totalServiceFee = 0;
      let subtotalBuyer = 0;
      const resolvedLines: ResolvedZoneLine[] = [];

      for (const item of dto.items) {
        const zone = await this.orderLifecycleService.findZoneWithLock(
          queryRunner.manager,
          item.zoneId,
          event.id,
          true,
        );

        if (!zone) {
          this.logger.warn(
            `[Culqi Prepare] Zona no encontrada: zoneId='${item.zoneId}' en evento id=${event.id} (${event.publicUuid}).`,
          );
          await queryRunner.rollbackTransaction();
          return err('ZONE_NOT_FOUND');
        }

        const maxPerOrder = Number(zone.maxTicketsPerOrder) || 4;
        if (item.quantity > maxPerOrder) {
          await queryRunner.rollbackTransaction();
          return err('TICKET_LIMIT_EXCEEDED');
        }

        const remainingZone = Math.max(
          0,
          Number(zone.capacity) - Number(zone.soldCount) - Number(zone.lockedCount),
        );
        if (remainingZone < item.quantity) {
          await queryRunner.rollbackTransaction();
          return err('INVALID_INPUT');
        }

        const lockedTiers = await queryRunner.manager
          .createQueryBuilder(ZonePricingTierEntity, 't')
          .setLock('pessimistic_write')
          .where('t.zoneId = :zoneId', { zoneId: zone.id })
          .orderBy('t.tierNumber', 'ASC')
          .getMany();

        const currentTier =
          lockedTiers.find(
            (t) =>
              t.isActive &&
              (!t.endAt || new Date(t.endAt) >= now) &&
              Number(t.soldCount) + Number(t.lockedCount) + item.quantity <= Number(t.capacity),
          ) || null;

        const pricing = resolveZoneTicketPricing(zone, currentTier);

        zone.lockedCount = Number(zone.lockedCount) + item.quantity;
        await queryRunner.manager.save(ZoneEntity, zone);

        if (currentTier) {
          currentTier.lockedCount = Number(currentTier.lockedCount) + item.quantity;
          await queryRunner.manager.save(ZonePricingTierEntity, currentTier);
        }

        subtotalTickets += pricing.unitBasePrice * item.quantity;
        totalServiceFee += pricing.unitServiceFee * item.quantity;
        subtotalBuyer += pricing.unitBuyerPrice * item.quantity;
        resolvedLines.push({
          zone,
          tier: currentTier,
          unitBasePrice: pricing.unitBasePrice,
          unitServiceFee: pricing.unitServiceFee,
          unitBuyerPrice: pricing.unitBuyerPrice,
          quantity: item.quantity,
        });
      }

      subtotalTickets = Math.round(subtotalTickets * 100) / 100;
      totalServiceFee = Math.round(totalServiceFee * 100) / 100;
      subtotalBuyer = Math.round(subtotalBuyer * 100) / 100;

      // Evaluar cupón sin consumirlo aún (se quema al confirmar pago)
      const couponEval = await this.orderLifecycleService.evaluateCoupon(
        queryRunner.manager,
        event.id,
        dto.couponCode,
        subtotalBuyer,
        { lockForUpdate: false, consumeNow: false },
      );

      if (couponEval.isErr()) {
        await queryRunner.rollbackTransaction();
        return err(couponEval.error);
      }

      const { coupon, discountAmount } = couponEval.value;
      const finalTotal = Math.max(0, Math.round((subtotalBuyer - discountAmount) * 100) / 100);
      const amountInCents = Math.round(finalTotal * 100);

      // Culqi exige un importe mínimo cobrable (desde S/ 1.00 = 100 céntimos)
      if (amountInCents < 100) {
        await queryRunner.rollbackTransaction();
        return err('INVALID_INPUT');
      }

      const expirationSeconds = this.culqiGatewayService.getOrderExpirationSeconds();
      const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

      const order = queryRunner.manager.create(OrderEntity, {
        userId: user.id,
        eventId: event.id,
        couponId: coupon ? coupon.id : null,
        status: 'pending',
        subtotalTickets,
        totalServiceFee,
        discountAmount,
        totalAmount: finalTotal,
        expiresAt,
      });

      const savedOrder = await queryRunner.manager.save(OrderEntity, order);

      // Crear tickets en estado 'locked' durante la ventana de pago
      const lockedTicketsToSave: TicketEntity[] = [];
      for (const line of resolvedLines) {
        for (let i = 0; i < line.quantity; i++) {
          lockedTicketsToSave.push(
            queryRunner.manager.create(TicketEntity, {
              showId: show.id,
              zoneId: line.zone.id,
              pricingTierId: line.tier ? line.tier.id : null,
              userId: user.id,
              orderId: savedOrder.id,
              paidBasePrice: line.unitBasePrice,
              paidServiceFee: line.unitServiceFee,
              qrCode: null,
              status: 'locked',
              lockedUntil: expiresAt,
            }),
          );
        }
      }
      await queryRunner.manager.save(TicketEntity, lockedTicketsToSave);

      // Crear Orden oficial en Culqi API v2 (/v2/orders) para habilitar Checkout Multipago
      const { firstName, lastName } = splitFullName(user.name);
      const phone = normalizePeruPhone(dto.customerPhone || user.organizerPhone);
      const orderNumber = `QPH-${savedOrder.id}-${Date.now().toString().slice(-5)}`;
      const description = `${totalOrderTickets} ${totalOrderTickets === 1 ? 'entrada' : 'entradas'} - ${event.name}`;

      const culqiOrderRes = await this.culqiGatewayService.createOrder({
        amount: amountInCents,
        currencyCode: 'PEN',
        description,
        orderNumber,
        clientDetails: {
          firstName,
          lastName,
          email: user.email,
          phoneNumber: phone,
        },
        expirationDateEpochSec: Math.floor(expiresAt.getTime() / 1000),
        metadata: {
          qph_order_id: String(savedOrder.id),
          qph_order_uuid: savedOrder.publicUuid,
          event_uuid: event.publicUuid,
          user_id: String(user.id),
          qph_user_id: String(user.id),
          ...(user.publicUuid ? { qph_user_uuid: user.publicUuid } : {}),
          ...(user.email ? { qph_user_email: user.email.slice(0, 100) } : {}),
        },
      });

      if (!culqiOrderRes.ok) {
        await queryRunner.rollbackTransaction();
        return err('GATEWAY_ERROR');
      }

      const payment = queryRunner.manager.create(PaymentEntity, {
        orderId: savedOrder.id,
        paymentMethod: dto.paymentMethod,
        amount: finalTotal,
        status: 'pending',
        externalTransactionId: culqiOrderRes.order.id,
        gatewayResponse: {
          provider: 'culqi',
          culqiOrderId: culqiOrderRes.order.id,
          culqiOrder: culqiOrderRes.order,
        },
      });
      await queryRunner.manager.save(PaymentEntity, payment);

      await queryRunner.commitTransaction();

      const publicConfig = this.culqiGatewayService.getPublicConfig();

      const responseDto = plainToInstance(
        PrepareCulqiCheckoutResponseDto,
        {
          orderId: savedOrder.id,
          orderCode: `#QPH-${String(savedOrder.id).padStart(6, '0')}`,
          orderPublicUuid: savedOrder.publicUuid,
          culqiOrderId: culqiOrderRes.order.id,
          amountInCents,
          totalAmount: finalTotal,
          currency: 'PEN',
          title: 'queplaneshoy • Entradas Oficiales',
          description: description.slice(0, 80),
          expiresAt: expiresAt.toISOString(),
          publicKey: publicConfig.publicKey,
          checkoutScriptUrl: publicConfig.checkoutScriptUrl,
          threeDsScriptUrl: publicConfig.threeDsScriptUrl,
          rsaId: publicConfig.rsaId,
          rsaPublicKey: publicConfig.rsaPublicKey,
          customer: {
            firstName,
            lastName,
            email: user.email,
            phone,
          },
        },
        { excludeExtraneousValues: true },
      );

      return ok(responseDto);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error preparando orden Culqi para evento ${dto.eventId}: ${error?.message || error}`,
      );
      return err('INTERNAL_ERROR');
    } finally {
      await queryRunner.release();
    }
  }
}

