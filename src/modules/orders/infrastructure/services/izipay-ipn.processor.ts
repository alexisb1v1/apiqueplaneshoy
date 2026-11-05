import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { IzipayService } from './izipay.service';

@Injectable()
export class IzipayIpnProcessor {
  private readonly logger = new Logger(IzipayIpnProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly izipayService: IzipayService,
  ) {}

  async processIpn(
    krAnswerRaw: string,
    krHash: string,
  ): Promise<{ success: boolean; message: string; orderId?: string }> {
    // 1. Validar firma criptográfica HMAC-SHA256 (Defensa contra falsificación)
    const isValidSignature = this.izipayService.verifyIpnSignature(
      krAnswerRaw,
      krHash,
    );
    if (!isValidSignature) {
      this.logger.error(
        '[Izipay IPN Rechazado] Firma criptográfica HMAC inválida.',
      );
      return { success: false, message: 'INVALID_SIGNATURE' };
    }

    let answer: any;
    try {
      answer = typeof krAnswerRaw === 'string' ? JSON.parse(krAnswerRaw) : krAnswerRaw;
    } catch (parseErr) {
      this.logger.error('[Izipay IPN Error] kr-answer no es un JSON válido', parseErr);
      return { success: false, message: 'INVALID_JSON' };
    }

    const orderStatus = answer.orderStatus; // 'PAID', 'REFUSED', 'UNPAID', etc.
    const orderDetails = answer.orderDetails || {};
    const rawOrderId = orderDetails.orderId || answer.orderId || '';

    // Extraer número de orden (ej: "#QPH-000012" -> "12", o ID directo)
    const cleanOrderId = rawOrderId.replace(/^#QPH-0*/, '').trim();

    this.logger.log(
      `[Izipay IPN Recibido] Orden: ${rawOrderId} (${cleanOrderId}), Estado: ${orderStatus}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Buscar la orden con bloqueo pesimista en PostgreSQL (sin outer joins para cumplimiento con FOR UPDATE)
      const order = await queryRunner.manager
        .createQueryBuilder(OrderEntity, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId: cleanOrderId })
        .getOne();

      if (!order) {
        this.logger.warn(`[Izipay IPN] Orden #${cleanOrderId} no encontrada en PostgreSQL.`);
        await queryRunner.rollbackTransaction();
        return { success: false, message: 'ORDER_NOT_FOUND' };
      }

      // 3. Garantía de Idempotencia: Si la orden ya está pagada, retornar éxito sin duplicar
      if (order.status === 'paid') {
        this.logger.log(
          `[Izipay IPN Idempotente] Orden #${order.id} ya fue confirmada previamente como pagada.`,
        );
        await queryRunner.commitTransaction();
        return { success: true, message: 'ALREADY_PAID', orderId: order.id };
      }

      const txList = answer.transactions || [];
      const primaryTx = txList[0] || {};
      const txUuid = primaryTx.uuid || `IZI-${Date.now()}`;

      // 4. Si el pago fue aprobado por Izipay (orderStatus === 'PAID')
      if (orderStatus === 'PAID') {
        order.status = 'paid';
        await queryRunner.manager.save(OrderEntity, order);

        // Registrar Pago
        const payment = queryRunner.manager.create(PaymentEntity, {
          orderId: order.id,
          paymentMethod: 'izipay',
          amount: order.totalAmount,
          status: 'approved',
          externalTransactionId: txUuid,
          gatewayResponse: answer,
        });
        await queryRunner.manager.save(PaymentEntity, payment);

        // Actualizar Cupón si fue aplicado
        if (order.couponId) {
          const coupon = await queryRunner.manager.findOne(CouponEntity, {
            where: { id: order.couponId },
          });
          if (coupon) {
            coupon.usedCount = Number(coupon.usedCount) + 1;
            if (coupon.usageType === 'single_use') {
              coupon.isActive = false;
            } else if (
              coupon.usageType === 'reusable' &&
              coupon.maxUses !== null &&
              Number(coupon.usedCount) >= Number(coupon.maxUses)
            ) {
              coupon.isActive = false;
            }
            await queryRunner.manager.save(CouponEntity, coupon);
          }
        }

        // Buscar el show y zonas para emitir tickets oficiales
        // Si ya había tickets asociados a la orden en estado 'locked', pasarlos a 'sold' y actualizar contadores
        const existingTickets = await queryRunner.manager.find(TicketEntity, {
          where: { orderId: order.id },
        });

        if (existingTickets.length > 0) {
          for (const t of existingTickets) {
            t.status = 'sold';
            await queryRunner.manager.save(TicketEntity, t);

            // Trasladar lockedCount a soldCount en la zona correspondiente
            const zone = await queryRunner.manager.findOne(ZoneEntity, {
              where: { id: t.zoneId },
            });
            if (zone) {
              zone.lockedCount = Math.max(0, Number(zone.lockedCount) - 1);
              zone.soldCount = Number(zone.soldCount) + 1;
              await queryRunner.manager.save(ZoneEntity, zone);
            }
          }
        } else {
          // Si no estaban creados previamente, resolvemos la primera función del usuario/evento
          const show = await queryRunner.manager.findOne(ShowEntity, {
            order: { startTime: 'ASC' },
          });
          const zone = await queryRunner.manager.findOne(ZoneEntity, {});

          if (show && zone) {
            const ticketUuid = randomUUID();
            const qrPayload = `QPH|ORD:${order.id}|TCK:${ticketUuid}|SHOW:${show.id}|ZONE:${zone.name}|TS:${Date.now()}`;

            const ticket = queryRunner.manager.create(TicketEntity, {
              publicUuid: ticketUuid,
              showId: show.id,
              zoneId: zone.id,
              userId: order.userId,
              orderId: order.id,
              paidBasePrice: order.totalAmount,
              paidServiceFee: 0.0,
              qrCode: qrPayload,
              status: 'sold',
            });
            await queryRunner.manager.save(TicketEntity, ticket);

            // Trasladar locked_count a sold_count
            zone.lockedCount = Math.max(0, Number(zone.lockedCount) - 1);
            zone.soldCount = Number(zone.soldCount) + 1;
            await queryRunner.manager.save(ZoneEntity, zone);
          }
        }

        await queryRunner.commitTransaction();
        this.logger.log(
          `[Izipay IPN Éxito] Orden #${order.id} procesada y confirmada exitosamente en PostgreSQL.`,
        );
        return { success: true, message: 'PAYMENT_PROCESSED', orderId: order.id };
      } else {
        // 5. Si fue rechazado (REFUSED / ERROR)
        order.status = 'cancelled';
        await queryRunner.manager.save(OrderEntity, order);

        // Liberar tickets 'locked' y restituir lockedCount en las zonas
        const lockedTickets = await queryRunner.manager.find(TicketEntity, {
          where: { orderId: order.id, status: 'locked' },
        });
        for (const t of lockedTickets) {
          t.status = 'cancelled';
          await queryRunner.manager.save(TicketEntity, t);

          const zone = await queryRunner.manager.findOne(ZoneEntity, {
            where: { id: t.zoneId },
          });
          if (zone) {
            zone.lockedCount = Math.max(0, Number(zone.lockedCount) - 1);
            await queryRunner.manager.save(ZoneEntity, zone);
          }
        }

        const payment = queryRunner.manager.create(PaymentEntity, {
          orderId: order.id,
          paymentMethod: 'izipay',
          amount: order.totalAmount,
          status: 'rejected',
          externalTransactionId: txUuid,
          gatewayResponse: answer,
        });
        await queryRunner.manager.save(PaymentEntity, payment);

        await queryRunner.commitTransaction();
        this.logger.warn(`[Izipay IPN Rechazado] Orden #${order.id} no fue pagada: ${orderStatus}.`);
        return { success: true, message: 'PAYMENT_REFUSED', orderId: order.id };
      }
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error('[Izipay IPN Exception] Error al procesar IPN en PostgreSQL', err);
      return { success: false, message: 'INTERNAL_ERROR' };
    } finally {
      await queryRunner.release();
    }
  }
}

