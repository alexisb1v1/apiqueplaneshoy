import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { SimulateOrderCheckoutCommand } from '../impl/simulate-order-checkout.command';
import {
  SimulateOrderCheckoutResponseDto,
  IssuedTicketResponseDto,
} from '../../dto/simulate-order-checkout.response.dto';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';

@CommandHandler(SimulateOrderCheckoutCommand)
export class SimulateOrderCheckoutHandler
  implements ICommandHandler<SimulateOrderCheckoutCommand, Result<SimulateOrderCheckoutResponseDto, AppError>> {
  private readonly logger = new Logger(SimulateOrderCheckoutHandler.name);

  constructor(private readonly dataSource: DataSource) { }

  async execute(
    command: SimulateOrderCheckoutCommand,
  ): Promise<Result<SimulateOrderCheckoutResponseDto, AppError>> {
    const { dto, authenticatedUserId } = command;

    // 1. Simulación probabilística de fallo (20% de probabilidad o forzado con forceFailure)
    if (dto.forceFailure || Math.random() < 0.2) {
      this.logger.warn(
        `[Pasarela Simulada] Transacción rechazada para método '${dto.paymentMethod}' (simulación de fallo bancario).`,
      );
      return err('PAYMENT_REJECTED');
    }

    // 2. Transacción atómica en PostgreSQL
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        // 2.1 Resolver usuario comprador estrictamente autenticado
        if (!authenticatedUserId) {
          await queryRunner.rollbackTransaction();
          return err('UNAUTHORIZED');
        }

        const user = await queryRunner.manager.findOne(UserEntity, {
          where: { id: authenticatedUserId },
        });

        if (!user) {
          await queryRunner.rollbackTransaction();
          return err('UNAUTHORIZED');
        }

        // 2.2 Validar evento y función (admite publicUuid seguro, slug o ID numérico)
        const isEventNumeric = /^\d+$/.test(String(dto.eventId));
        const isEventUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(dto.eventId));
        const eventWhere = isEventNumeric
          ? { id: String(dto.eventId) }
          : isEventUuid
          ? { publicUuid: String(dto.eventId) }
          : { slug: String(dto.eventId) };

        const event = await queryRunner.manager.findOne(EventEntity, {
          where: eventWhere,
        });

        if (!event) {
          await queryRunner.rollbackTransaction();
          return err('NOT_FOUND');
        }

        const isShowNumeric = /^\d+$/.test(String(dto.showId));
        const isShowUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(dto.showId));
        const showWhere = isShowNumeric
          ? { id: String(dto.showId), eventId: event.id }
          : isShowUuid
          ? { publicUuid: String(dto.showId), eventId: event.id }
          : { id: String(dto.showId), eventId: event.id };

        const show = await queryRunner.manager.findOne(ShowEntity, {
          where: showWhere,
        });

        if (!show) {
          await queryRunner.rollbackTransaction();
          return err('NOT_FOUND');
        }

        // 2.3 Validar límites de venta por compra y por evento (DevSecOps / Regla de Negocio)
        const totalOrderTickets = (dto.items || []).reduce(
          (acc, curr) => acc + (Number(curr.quantity) || 0),
          0,
        );

        if (totalOrderTickets <= 0) {
          await queryRunner.rollbackTransaction();
          return err('INVALID_INPUT');
        }

        const eventTicketLimit = Number(event.userTicketLimit) || 6;

        // A. Límite global acumulado del usuario para este evento (Regla 1: Por Evento)
        const userBoughtTicketsCount = await queryRunner.manager
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin('t.order', 'o')
          .innerJoin('t.show', 's')
          .where('s.eventId = :eventId', { eventId: event.id })
          .andWhere('o.userId = :userId', { userId: user.id })
          .andWhere('o.status = :orderStatus', { orderStatus: 'paid' })
          .andWhere('t.status IN (:...ticketStatuses)', {
            ticketStatuses: ['sold', 'used', 'locked'],
          })
          .getCount();

        if (userBoughtTicketsCount + totalOrderTickets > eventTicketLimit) {
          this.logger.warn(
            `[Límite Excedido] Usuario ${user.email} ya posee ${userBoughtTicketsCount} entradas para '${event.name}' e intenta adquirir ${totalOrderTickets} más (Tope permitido: ${eventTicketLimit}).`,
          );
          await queryRunner.rollbackTransaction();
          return err('TICKET_LIMIT_EXCEEDED');
        }

        // 2.4 Validar zonas, aforo, límites por zona y calcular montos
        let subtotal = 0;
        const zoneItemsResolved: Array<{
          zone: ZoneEntity;
          unitPrice: number;
          tierName: string;
          quantity: number;
        }> = [];

        const now = new Date();

        for (const item of dto.items) {
          const isZoneNumeric = /^\d+$/.test(String(item.zoneId));
          const isZoneUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.zoneId));
          const zoneWhere = isZoneNumeric
            ? { id: String(item.zoneId), eventId: event.id }
            : isZoneUuid
            ? { publicUuid: String(item.zoneId), eventId: event.id }
            : { id: String(item.zoneId), eventId: event.id };

          const zone = await queryRunner.manager.findOne(ZoneEntity, {
            where: zoneWhere,
            relations: { pricingTiers: true },
          });

          if (!zone) {
            await queryRunner.rollbackTransaction();
            return err('NOT_FOUND');
          }

          // B. Límite por orden en la zona (Regla 2: Por Orden en Pasarela)
          const maxPerOrder = Number(zone.maxTicketsPerOrder) || 4;
          if (item.quantity > maxPerOrder) {
            this.logger.warn(
              `[Límite Excedido] Cantidad de ${item.quantity} supera el máximo por orden (${maxPerOrder}) para la zona '${zone.name}'.`,
            );
            await queryRunner.rollbackTransaction();
            return err('TICKET_LIMIT_EXCEEDED');
          }

          const cap = Number(zone.capacity) || 0;
          const sold = Number(zone.soldCount) || 0;
          const locked = Number(zone.lockedCount) || 0;
          const remaining = Math.max(0, cap - sold - locked);

          if (remaining < item.quantity) {
            await queryRunner.rollbackTransaction();
            return err('INVALID_INPUT');
          }

          // Determinar precio según tiers vigentes
          const activeTiers = (zone.pricingTiers || [])
            .filter(
              (t) =>
                t.isActive &&
                (!t.endAt || new Date(t.endAt) >= now) &&
                Number(t.soldCount) < Number(t.capacity),
            )
            .sort((a, b) => a.tierNumber - b.tierNumber);

          const currentTier = activeTiers[0];
          const unitPrice = currentTier ? Number(currentTier.price) : Number(zone.regularPrice);
          const tierName = currentTier ? currentTier.name : zone.title || zone.name;

          subtotal += unitPrice * item.quantity;

          zoneItemsResolved.push({
            zone,
            unitPrice,
            tierName,
            quantity: item.quantity,
          });
        }

        // 2.3.5 Doble Check Atómico de Cupón de Descuento (Validación en Transacción con Bloqueo)
        let discountAmount = 0.0;
        let appliedCoupon: CouponEntity | null = null;

        if (dto.couponCode && dto.couponCode.trim()) {
          const normalizedCode = dto.couponCode.trim().toUpperCase();

          // Bloqueo pesimista de escritura (SELECT FOR UPDATE) para prevenir colisiones concurrentes
          appliedCoupon = await queryRunner.manager
            .createQueryBuilder(CouponEntity, 'c')
            .setLock('pessimistic_write')
            .where('c.eventId = :eventId', { eventId: event.id })
            .andWhere('UPPER(c.code) = :code', { code: normalizedCode })
            .getOne();

          if (!appliedCoupon) {
            this.logger.warn(`[Doble Check Cupón] Cupón '${normalizedCode}' no existe para el evento ${event.id}.`);
            await queryRunner.rollbackTransaction();
            return err('COUPON_INVALID_OR_EXPIRED');
          }

          if (!appliedCoupon.isActive) {
            this.logger.warn(`[Doble Check Cupón] Cupón '${normalizedCode}' se encuentra inactivo.`);
            await queryRunner.rollbackTransaction();
            return err('COUPON_INVALID_OR_EXPIRED');
          }

          // Caso 3: Vigencia por fecha y hora
          if (appliedCoupon.startsAt && now < new Date(appliedCoupon.startsAt)) {
            this.logger.warn(`[Doble Check Cupón] Cupón '${normalizedCode}' aún no inicia vigencia.`);
            await queryRunner.rollbackTransaction();
            return err('COUPON_INVALID_OR_EXPIRED');
          }
          if (appliedCoupon.expiresAt && now > new Date(appliedCoupon.expiresAt)) {
            this.logger.warn(`[Doble Check Cupón] Cupón '${normalizedCode}' expiró el ${appliedCoupon.expiresAt}.`);
            await queryRunner.rollbackTransaction();
            return err('COUPON_INVALID_OR_EXPIRED');
          }

          // Caso 1: De una sola vida (single_use)
          if (appliedCoupon.usageType === 'single_use' && Number(appliedCoupon.usedCount) >= 1) {
            this.logger.warn(`[Doble Check Cupón] Cupón de un solo uso '${normalizedCode}' ya fue utilizado.`);
            await queryRunner.rollbackTransaction();
            return err('COUPON_INVALID_OR_EXPIRED');
          }

          // Caso 2: Reusable N veces (reusable con max_uses)
          if (
            appliedCoupon.usageType === 'reusable' &&
            appliedCoupon.maxUses !== null &&
            Number(appliedCoupon.usedCount) >= Number(appliedCoupon.maxUses)
          ) {
            this.logger.warn(`[Doble Check Cupón] Cupón '${normalizedCode}' alcanzó su cupo máximo de ${appliedCoupon.maxUses} canjes.`);
            await queryRunner.rollbackTransaction();
            return err('COUPON_INVALID_OR_EXPIRED');
          }

          // Validación de monto mínimo de orden
          if (appliedCoupon.minOrderAmount !== null && subtotal < Number(appliedCoupon.minOrderAmount)) {
            this.logger.warn(`[Doble Check Cupón] Subtotal ${subtotal} no alcanza monto mínimo ${appliedCoupon.minOrderAmount}.`);
            await queryRunner.rollbackTransaction();
            return err('INVALID_INPUT');
          }

          // Cálculo del descuento según tipo (% o soles)
          const discountVal = Number(appliedCoupon.discountValue) || 0;
          if (appliedCoupon.discountType === 'percentage') {
            discountAmount = Math.round((subtotal * (discountVal / 100)) * 100) / 100;
          } else {
            discountAmount = Math.min(subtotal, discountVal);
          }

          // Actualización atómica del ciclo de vida del cupón
          appliedCoupon.usedCount = Number(appliedCoupon.usedCount) + 1;

          // Regla de invalidación:
          // Si es single_use: se apaga de inmediato
          if (appliedCoupon.usageType === 'single_use') {
            appliedCoupon.isActive = false;
          } else if (
            appliedCoupon.usageType === 'reusable' &&
            appliedCoupon.maxUses !== null &&
            Number(appliedCoupon.usedCount) >= Number(appliedCoupon.maxUses)
          ) {
            // Si es reusable y llegó a N usos: se auto-invalida
            appliedCoupon.isActive = false;
          }

          await queryRunner.manager.save(CouponEntity, appliedCoupon);
          this.logger.log(
            `[Doble Check Cupón Exitoso] Código '${normalizedCode}' aplicado: -S/. ${discountAmount.toFixed(2)}. Usos: ${appliedCoupon.usedCount}. Activo: ${appliedCoupon.isActive}`,
          );
        }

        const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

        // 2.4 Crear Orden
        const order = queryRunner.manager.create(OrderEntity, {
          userId: user.id,
          couponId: appliedCoupon ? appliedCoupon.id : null,
          status: 'paid',
          subtotalTickets: subtotal,
          totalServiceFee: 0.0,
          discountAmount: discountAmount,
          totalAmount: finalTotal,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        const savedOrder = await queryRunner.manager.save(OrderEntity, order);

        // 2.5 Registrar Pago Aprobado
        const externalTx = `TX-${Math.floor(100000 + Math.random() * 900000)}`;
        const payment = queryRunner.manager.create(PaymentEntity, {
          orderId: savedOrder.id,
          paymentMethod: dto.paymentMethod,
          amount: finalTotal,
          status: 'approved',
          externalTransactionId: externalTx,
          gatewayResponse: {
            gateway: `simulated_${dto.paymentMethod}`,
            authorizationCode: `AUTH-${Date.now()}`,
            approvedAt: new Date().toISOString(),
            simulated: true,
          },
        });

        await queryRunner.manager.save(PaymentEntity, payment);

        // 2.6 Emitir Tickets y actualizar aforo vendido
        const issuedTickets: IssuedTicketResponseDto[] = [];
        let ticketCounter = 1;

        for (const resolved of zoneItemsResolved) {
          for (let i = 0; i < resolved.quantity; i++) {
            const ticketUuid = randomUUID();
            // Cripto-Token para código QR seguro
            const qrPayload = `QPH|ORD:${savedOrder.id}|TCK:${ticketUuid}|EVT:${event.id}|SHOW:${show.id}|ZONE:${resolved.zone.name}|TKT:${ticketCounter}|TS:${Date.now()}`;

            const ticket = queryRunner.manager.create(TicketEntity, {
              publicUuid: ticketUuid,
              showId: show.id,
              zoneId: resolved.zone.id,
              userId: user.id,
              orderId: savedOrder.id,
              paidBasePrice: resolved.unitPrice,
              paidServiceFee: 0.0,
              qrCode: qrPayload,
              status: 'sold',
            });

            const savedTicket = await queryRunner.manager.save(TicketEntity, ticket);

            issuedTickets.push({
              ticketId: savedTicket.id,
              ticketUuid: savedTicket.publicUuid,
              ticketNumber: ticketCounter,
              zoneName: resolved.zone.name,
              tierName: resolved.tierName,
              unitPrice: resolved.unitPrice,
              qrPayload,
            });

            ticketCounter++;
          }

          // Actualizar aforo vendido en la zona
          resolved.zone.soldCount = Number(resolved.zone.soldCount) + resolved.quantity;
          await queryRunner.manager.save(ZoneEntity, resolved.zone);
        }

        // 2.7 Confirmar transacción en PostgreSQL
        await queryRunner.commitTransaction();

        this.logger.log(
          `[Orden Completada] Orden #${savedOrder.id} (${savedOrder.publicUuid}) pagada con éxito con ${dto.paymentMethod}. Total: S/. ${finalTotal.toFixed(2)}. ${issuedTickets.length} tickets emitidos.`,
        );

        const responseDto = plainToInstance(
          SimulateOrderCheckoutResponseDto,
          {
            success: true,
            orderId: savedOrder.id,
            orderCode: `#QPH-${savedOrder.id.padStart(6, '0')}`,
            orderPublicUuid: savedOrder.publicUuid,
            status: 'paid',
            subtotal,
            discountAmount,
            couponCode: appliedCoupon ? appliedCoupon.code.toUpperCase() : null,
            totalAmount: finalTotal,
            paymentMethod: dto.paymentMethod,
            txCode: externalTx,
            message: '¡Pago simulado procesado exitosamente por la pasarela de pagos!',
            tickets: issuedTickets,
          },
          { excludeExtraneousValues: true },
        );

        return ok(responseDto);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Error al procesar la orden simulada en PostgreSQL', error);
        return err('INTERNAL_ERROR');
      } finally {
        await queryRunner.release();
      }
    }
}

