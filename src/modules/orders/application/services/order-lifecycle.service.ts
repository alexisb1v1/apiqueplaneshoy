import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ZonePricingTierEntity } from '@events/domain/entities/zone-pricing-tier.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { MailService } from '@modules/mail/mail.service';
import {
  IssuedTicketResponseDto,
  SimulateOrderCheckoutResponseDto,
} from '../../dto/simulate-order-checkout.response.dto';

export interface EvaluatedCouponResult {
  coupon: CouponEntity | null;
  discountAmount: number;
}

export interface FinalizePaidOrderInput {
  orderIdOrUuid: string;
  paymentMethod: string;
  externalTransactionId: string;
  gatewayResponse: Record<string, unknown>;
  successMessage?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  /**
   * Resuelve un evento por ID numérico, UUID público o slug.
   */
  async findEventByIdentifier(
    manager: EntityManager,
    eventIdentifier: string,
  ): Promise<EventEntity | null> {
    const raw = String(eventIdentifier || '').trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      return manager.findOne(EventEntity, { where: { id: raw } });
    }
    if (UUID_REGEX.test(raw)) {
      return manager.findOne(EventEntity, { where: { publicUuid: raw } });
    }
    return manager.findOne(EventEntity, { where: { slug: raw } });
  }

  /**
   * Resuelve una función (show) verificando que pertenezca al evento indicado.
   */
  async findShowByIdentifier(
    manager: EntityManager,
    showIdentifier: string,
    eventId: string,
  ): Promise<ShowEntity | null> {
    const raw = String(showIdentifier || '').trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      return manager.findOne(ShowEntity, { where: { id: raw, eventId } });
    }
    if (UUID_REGEX.test(raw)) {
      return manager.findOne(ShowEntity, { where: { publicUuid: raw, eventId } });
    }
    return null;
  }

  /**
   * Resuelve una zona perteneciente al evento con bloqueo pesimista opcional en escritura.
   */
  async findZoneWithLock(
    manager: EntityManager,
    zoneIdentifier: string,
    eventId: string,
    lockWrite = false,
  ): Promise<ZoneEntity | null> {
    const raw = String(zoneIdentifier || '').trim();
    if (!raw) return null;

    const qb = manager
      .createQueryBuilder(ZoneEntity, 'z')
      .where('z.eventId = :eventId', { eventId });

    if (/^\d+$/.test(raw)) {
      qb.andWhere('z.id = :zoneId', { zoneId: raw });
    } else if (UUID_REGEX.test(raw)) {
      qb.andWhere('z.publicUuid = :zoneUuid', { zoneUuid: raw });
    } else {
      return null;
    }

    if (lockWrite) {
      qb.setLock('pessimistic_write');
    }

    return qb.getOne();
  }

  /**
   * Evalúa un cupón aplicando las 6 reglas de negocio oficiales dentro del contexto transaccional.
   */
  async evaluateCoupon(
    manager: EntityManager,
    eventId: string,
    couponCode: string | undefined,
    subtotal: number,
    options: { lockForUpdate?: boolean; consumeNow?: boolean } = {},
  ): Promise<Result<EvaluatedCouponResult, AppError>> {
    if (!couponCode || !couponCode.trim()) {
      return ok({ coupon: null, discountAmount: 0 });
    }

    const normalizedCode = couponCode.trim().toUpperCase();
    const qb = manager
      .createQueryBuilder(CouponEntity, 'c')
      .where('c.eventId = :eventId', { eventId })
      .andWhere('UPPER(c.code) = :code', { code: normalizedCode });

    if (options.lockForUpdate) {
      qb.setLock('pessimistic_write');
    }

    const coupon = await qb.getOne();
    if (!coupon || !coupon.isActive) {
      return err('COUPON_INVALID_OR_EXPIRED');
    }

    const now = new Date();
    if (coupon.startsAt && now < new Date(coupon.startsAt)) {
      return err('COUPON_INVALID_OR_EXPIRED');
    }
    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
      return err('COUPON_INVALID_OR_EXPIRED');
    }
    if (coupon.usageType === 'single_use' && Number(coupon.usedCount) >= 1) {
      return err('COUPON_INVALID_OR_EXPIRED');
    }
    if (
      coupon.usageType === 'reusable' &&
      coupon.maxUses !== null &&
      Number(coupon.usedCount) >= Number(coupon.maxUses)
    ) {
      return err('COUPON_INVALID_OR_EXPIRED');
    }
    if (coupon.minOrderAmount !== null && subtotal < Number(coupon.minOrderAmount)) {
      return err('INVALID_INPUT');
    }

    const discountVal = Number(coupon.discountValue) || 0;
    const discountAmount =
      coupon.discountType === 'percentage'
        ? Math.round(subtotal * (discountVal / 100) * 100) / 100
        : Math.min(subtotal, discountVal);

    if (options.consumeNow) {
      coupon.usedCount = Number(coupon.usedCount) + 1;
      if (
        coupon.usageType === 'single_use' ||
        (coupon.usageType === 'reusable' &&
          coupon.maxUses !== null &&
          Number(coupon.usedCount) >= Number(coupon.maxUses))
      ) {
        coupon.isActive = false;
      }
      await manager.save(CouponEntity, coupon);
    }

    return ok({ coupon, discountAmount });
  }

  /**
   * Libera atómicamente una orden pendiente y devuelve su inventario bloqueado en zonas y preventas.
   */
  async releasePendingOrder(
    manager: EntityManager,
    orderId: string,
    targetStatus: 'expired' | 'cancelled',
  ): Promise<boolean> {
    const order = await manager
      .createQueryBuilder(OrderEntity, 'o')
      .setLock('pessimistic_write')
      .where('o.id = :orderId', { orderId })
      .getOne();

    if (!order || order.status !== 'pending') {
      return false;
    }

    const lockedTickets = await manager.find(TicketEntity, {
      where: { orderId: order.id, status: 'locked' },
    });

    const zoneReleaseCounts = new Map<string, number>();
    const tierReleaseCounts = new Map<string, number>();

    for (const ticket of lockedTickets) {
      zoneReleaseCounts.set(ticket.zoneId, (zoneReleaseCounts.get(ticket.zoneId) || 0) + 1);
      if (ticket.pricingTierId) {
        tierReleaseCounts.set(
          ticket.pricingTierId,
          (tierReleaseCounts.get(ticket.pricingTierId) || 0) + 1,
        );
      }
      ticket.status = 'cancelled';
      ticket.lockedUntil = null;
    }

    if (lockedTickets.length > 0) {
      await manager.save(TicketEntity, lockedTickets);
    }

    for (const [zoneId, qty] of zoneReleaseCounts.entries()) {
      const zone = await manager
        .createQueryBuilder(ZoneEntity, 'z')
        .setLock('pessimistic_write')
        .where('z.id = :zoneId', { zoneId })
        .getOne();
      if (zone) {
        zone.lockedCount = Math.max(0, Number(zone.lockedCount) - qty);
        await manager.save(ZoneEntity, zone);
      }
    }

    for (const [tierId, qty] of tierReleaseCounts.entries()) {
      const tier = await manager
        .createQueryBuilder(ZonePricingTierEntity, 't')
        .setLock('pessimistic_write')
        .where('t.id = :tierId', { tierId })
        .getOne();
      if (tier) {
        tier.lockedCount = Math.max(0, Number(tier.lockedCount) - qty);
        await manager.save(ZonePricingTierEntity, tier);
      }
    }

    order.status = targetStatus;
    await manager.save(OrderEntity, order);

    const pendingPayments = await manager.find(PaymentEntity, {
      where: { orderId: order.id, status: 'pending' },
    });
    for (const pendingPayment of pendingPayments) {
      pendingPayment.status = 'rejected';
    }
    if (pendingPayments.length > 0) {
      await manager.save(PaymentEntity, pendingPayments);
    }

    return true;
  }

  /**
   * Finaliza de forma atómica e idempotente una orden confirmada por la pasarela Culqi.
   *
   * @param input - Identificador de la orden, transacción externa y respuesta de pasarela
   * @returns `SimulateOrderCheckoutResponseDto` listo para mostrar boletos QR o `AppError`
   */
  async finalizePaidOrder(
    input: FinalizePaidOrderInput,
  ): Promise<Result<SimulateOrderCheckoutResponseDto, AppError>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const qb = queryRunner.manager
        .createQueryBuilder(OrderEntity, 'o')
        .setLock('pessimistic_write');

      if (UUID_REGEX.test(input.orderIdOrUuid)) {
        qb.where('o.publicUuid = :uuid', { uuid: input.orderIdOrUuid });
      } else if (/^\d+$/.test(String(input.orderIdOrUuid))) {
        qb.where('o.id = :id', { id: String(input.orderIdOrUuid) });
      } else {
        await queryRunner.rollbackTransaction();
        return err('NOT_FOUND');
      }

      const order = await qb.getOne();
      if (!order) {
        await queryRunner.rollbackTransaction();
        return err('NOT_FOUND');
      }

      // Idempotencia: si ya fue pagada previamente (webhook + polling concurrentes), retornar boletos ya emitidos
      if (order.status === 'paid') {
        const alreadyPaidDto = await this.buildCheckoutResponseFromPaidOrder(
          queryRunner.manager,
          order,
          input.successMessage,
        );
        await queryRunner.commitTransaction();
        return ok(alreadyPaidDto);
      }

      if (order.status !== 'pending') {
        await queryRunner.rollbackTransaction();
        this.logger.warn(
          `[Candado Culqi] Orden #${order.id} se encuentra en estado '${order.status}' y no puede emitirse.`,
        );
        return err('ORDER_EXPIRED');
      }

      // Consumir cupón si la orden tenía uno vinculado
      let couponCode: string | null = null;
      if (order.couponId) {
        const coupon = await queryRunner.manager
          .createQueryBuilder(CouponEntity, 'c')
          .setLock('pessimistic_write')
          .where('c.id = :couponId', { couponId: order.couponId })
          .getOne();

        if (coupon) {
          couponCode = coupon.code.toUpperCase();
          coupon.usedCount = Number(coupon.usedCount) + 1;
          if (
            coupon.usageType === 'single_use' ||
            (coupon.usageType === 'reusable' &&
              coupon.maxUses !== null &&
              Number(coupon.usedCount) >= Number(coupon.maxUses))
          ) {
            coupon.isActive = false;
          }
          await queryRunner.manager.save(CouponEntity, coupon);
        }
      }

      // Actualizar estado de la orden a pagada
      order.status = 'paid';
      await queryRunner.manager.save(OrderEntity, order);

      // Actualizar o registrar pago aprobado
      let payment = await queryRunner.manager.findOne(PaymentEntity, {
        where: { orderId: order.id },
        order: { id: 'DESC' },
      });

      const mergedGatewayResponse = {
        ...(payment?.gatewayResponse || {}),
        ...input.gatewayResponse,
        approvedAt: new Date().toISOString(),
      };

      if (payment) {
        payment.paymentMethod = input.paymentMethod;
        payment.amount = Number(order.totalAmount);
        payment.status = 'approved';
        payment.externalTransactionId = input.externalTransactionId;
        payment.gatewayResponse = mergedGatewayResponse;
        await queryRunner.manager.save(PaymentEntity, payment);
      } else {
        payment = queryRunner.manager.create(PaymentEntity, {
          orderId: order.id,
          paymentMethod: input.paymentMethod,
          amount: Number(order.totalAmount),
          status: 'approved',
          externalTransactionId: input.externalTransactionId,
          gatewayResponse: mergedGatewayResponse,
        });
        await queryRunner.manager.save(PaymentEntity, payment);
      }

      // Emitir tickets bloqueados y consolidar aforo vendido en zonas y tiers
      const lockedTickets = await queryRunner.manager.find(TicketEntity, {
        where: { orderId: order.id, status: 'locked' },
        order: { id: 'ASC' },
      });

      const zoneTotals = new Map<string, number>();
      const tierTotals = new Map<string, number>();
      const zonesCache = new Map<string, ZoneEntity>();
      const tiersCache = new Map<string, ZonePricingTierEntity>();
      const showsCache = new Map<string, ShowEntity>();

      const issuedTickets: IssuedTicketResponseDto[] = [];
      let ticketNumber = 1;

      for (const ticket of lockedTickets) {
        if (!zonesCache.has(ticket.zoneId)) {
          const zone = await queryRunner.manager
            .createQueryBuilder(ZoneEntity, 'z')
            .setLock('pessimistic_write')
            .where('z.id = :zoneId', { zoneId: ticket.zoneId })
            .getOne();
          if (zone) zonesCache.set(ticket.zoneId, zone);
        }
        const zone = zonesCache.get(ticket.zoneId);

        if (ticket.pricingTierId && !tiersCache.has(ticket.pricingTierId)) {
          const tier = await queryRunner.manager
            .createQueryBuilder(ZonePricingTierEntity, 't')
            .setLock('pessimistic_write')
            .where('t.id = :tierId', { tierId: ticket.pricingTierId })
            .getOne();
          if (tier) tiersCache.set(ticket.pricingTierId, tier);
        }
        const tier = ticket.pricingTierId ? tiersCache.get(ticket.pricingTierId) : undefined;

        if (!showsCache.has(ticket.showId)) {
          const show = await queryRunner.manager.findOne(ShowEntity, {
            where: { id: ticket.showId },
          });
          if (show) showsCache.set(ticket.showId, show);
        }
        const show = showsCache.get(ticket.showId);

        const zoneName = zone?.name || 'GENERAL';
        const tierName = tier?.name || zone?.title || zoneName;
        const eventIdRef = show?.eventId || '0';
        const qrPayload =
          ticket.qrCode ||
          `QPH|ORD:${order.id}|TCK:${ticket.publicUuid}|EVT:${eventIdRef}|SHOW:${ticket.showId}|ZONE:${zoneName}|TKT:${ticketNumber}|TS:${Date.now()}`;

        ticket.qrCode = qrPayload;
        ticket.status = 'sold';
        ticket.lockedUntil = null;
        await queryRunner.manager.save(TicketEntity, ticket);

        zoneTotals.set(ticket.zoneId, (zoneTotals.get(ticket.zoneId) || 0) + 1);
        if (ticket.pricingTierId) {
          tierTotals.set(ticket.pricingTierId, (tierTotals.get(ticket.pricingTierId) || 0) + 1);
        }

        issuedTickets.push({
          ticketId: ticket.id,
          ticketUuid: ticket.publicUuid,
          ticketNumber,
          zoneName,
          tierName,
          unitPrice: Number(ticket.paidBasePrice || 0),
          qrPayload,
        });

        ticketNumber++;
      }

      for (const [zoneId, qty] of zoneTotals.entries()) {
        const zone = zonesCache.get(zoneId);
        if (zone) {
          zone.lockedCount = Math.max(0, Number(zone.lockedCount) - qty);
          zone.soldCount = Number(zone.soldCount) + qty;
          await queryRunner.manager.save(ZoneEntity, zone);
        }
      }

      for (const [tierId, qty] of tierTotals.entries()) {
        const tier = tiersCache.get(tierId);
        if (tier) {
          tier.lockedCount = Math.max(0, Number(tier.lockedCount) - qty);
          tier.soldCount = Number(tier.soldCount) + qty;
          await queryRunner.manager.save(ZonePricingTierEntity, tier);
        }
      }

      const firstShow = showsCache.values().next().value as ShowEntity | undefined;
      const [event, buyer] = await Promise.all([
        firstShow?.eventId
          ? queryRunner.manager.findOne(EventEntity, { where: { id: firstShow.eventId } })
          : Promise.resolve(null),
        queryRunner.manager.findOne(UserEntity, { where: { id: order.userId } }),
      ]);

      await queryRunner.commitTransaction();

      this.logger.log(
        `[Culqi Orden Confirmada] Orden #${order.id} (${order.publicUuid}) pagada. Tx: ${input.externalTransactionId}. Total: S/. ${Number(order.totalAmount).toFixed(2)}. ${issuedTickets.length} boletos emitidos.`,
      );

      const orderCode = `#QPH-${String(order.id).padStart(6, '0')}`;

      if (buyer?.email) {
        const showStartTime = firstShow?.startTime ? new Date(firstShow.startTime) : new Date();
        const cityInfo = resolveCityFromUbigeo(event?.ubigeoCode);
        const eventDateFormatted = new Intl.DateTimeFormat('es-PE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'America/Lima',
        }).format(showStartTime);
        const eventTimeFormatted = new Intl.DateTimeFormat('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Lima',
        }).format(showStartTime);

        const discountVal = Number(order.discountAmount || 0);

        void this.mailService
          .sendOrderTicketsEmail({
            to: buyer.email,
            customerName: buyer.name || buyer.email,
            orderCode,
            txCode: input.externalTransactionId,
            eventTitle: event?.name || 'Evento Oficial queplaneshoy',
            eventDateFormatted,
            eventTimeFormatted,
            venueName: event?.venue || 'Recinto Confirmado',
            venueAddress: event?.address || null,
            city: cityInfo.name || 'Perú',
            totalAmountFormatted: `S/. ${Number(order.totalAmount).toFixed(2)}`,
            couponCode,
            discountAmountFormatted: discountVal > 0 ? `S/. ${discountVal.toFixed(2)}` : null,
            tickets: issuedTickets.map((t) => ({
              ticketCode: `QPH-TCK-${t.ticketUuid.substring(0, 8).toUpperCase()}`,
              zoneName: t.zoneName,
              tierName: t.tierName,
              unitPriceFormatted: `S/. ${t.unitPrice.toFixed(2)}`,
              qrPayload: t.qrPayload,
            })),
          })
          .catch((mailErr) => {
            this.logger.warn(
              `[Culqi Correo Tickets] No se pudo enviar correo de entradas para orden ${orderCode}: ${(mailErr as Error).message}`,
            );
          });
      }

      const responseDto = plainToInstance(
        SimulateOrderCheckoutResponseDto,
        {
          success: true,
          orderId: order.id,
          orderCode,
          orderPublicUuid: order.publicUuid,
          status: 'paid',
          subtotal: Number(order.subtotalTickets),
          discountAmount: Number(order.discountAmount),
          couponCode,
          totalAmount: Number(order.totalAmount),
          paymentMethod: input.paymentMethod,
          txCode: input.externalTransactionId,
          message:
            input.successMessage || '¡Pago confirmado exitosamente con Culqi Multipago!',
          tickets: issuedTickets,
        },
        { excludeExtraneousValues: true },
      );

      return ok(responseDto);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error finalizando orden ${input.orderIdOrUuid}: ${error?.message || error}`,
      );
      return err('INTERNAL_ERROR');
    } finally {
      await queryRunner.release();
    }
  }

  private async buildCheckoutResponseFromPaidOrder(
    manager: EntityManager,
    order: OrderEntity,
    successMessage?: string,
  ): Promise<SimulateOrderCheckoutResponseDto> {
    const tickets = await manager.find(TicketEntity, {
      where: { orderId: order.id },
      relations: { zone: true, pricingTier: true },
      order: { id: 'ASC' },
    });

    const payment = await manager.findOne(PaymentEntity, {
      where: { orderId: order.id, status: 'approved' },
      order: { id: 'DESC' },
    });

    const coupon = order.couponId
      ? await manager.findOne(CouponEntity, { where: { id: order.couponId } })
      : null;

    const issuedTickets: IssuedTicketResponseDto[] = tickets.map((t, index) => ({
      ticketId: t.id,
      ticketUuid: t.publicUuid,
      ticketNumber: index + 1,
      zoneName: t.zone?.name || 'GENERAL',
      tierName: t.pricingTier?.name || t.zone?.title || t.zone?.name || 'General',
      unitPrice: Number(t.paidBasePrice || 0),
      qrPayload:
        t.qrCode || `QPH|ORD:${order.id}|TCK:${t.publicUuid}|TKT:${index + 1}`,
    }));

    return plainToInstance(
      SimulateOrderCheckoutResponseDto,
      {
        success: true,
        orderId: order.id,
        orderCode: `#QPH-${String(order.id).padStart(6, '0')}`,
        orderPublicUuid: order.publicUuid,
        status: 'paid',
        subtotal: Number(order.subtotalTickets),
        discountAmount: Number(order.discountAmount),
        couponCode: coupon ? coupon.code.toUpperCase() : null,
        totalAmount: Number(order.totalAmount),
        paymentMethod: payment?.paymentMethod || 'card',
        txCode: payment?.externalTransactionId || `TX-${order.id}`,
        message: successMessage || '¡Pago confirmado exitosamente con Culqi Multipago!',
        tickets: issuedTickets,
      },
      { excludeExtraneousValues: true },
    );
  }
}

