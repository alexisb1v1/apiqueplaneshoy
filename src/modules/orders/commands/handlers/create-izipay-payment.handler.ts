import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { AppError } from '@common/errors/app-errors';
import { CreateIzipayPaymentCommand } from '../impl/create-izipay-payment.command';
import { CreateIzipayPaymentResponseDto } from '../../dto/create-izipay-payment.response.dto';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { IzipayService } from '../../infrastructure/services/izipay.service';

@CommandHandler(CreateIzipayPaymentCommand)
export class CreateIzipayPaymentHandler
  implements
    ICommandHandler<
      CreateIzipayPaymentCommand,
      Result<CreateIzipayPaymentResponseDto, AppError>
    > {
  private readonly logger = new Logger(CreateIzipayPaymentHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly izipayService: IzipayService,
  ) {}

  async execute(
    command: CreateIzipayPaymentCommand,
  ): Promise<Result<CreateIzipayPaymentResponseDto, AppError>> {
    const { dto, authenticatedUserId } = command;
    const now = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Obtener Comprador
      const user = await queryRunner.manager.findOne(UserEntity, {
        where: { id: authenticatedUserId },
      });
      if (!user) {
        await queryRunner.rollbackTransaction();
        return err('NOT_FOUND');
      }

      // 2. Obtener Evento (admite publicUuid seguro, slug o ID numérico)
      const isEventNumeric = /^\d+$/.test(String(dto.eventId));
      const isEventUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(dto.eventId),
        );
      const eventWhere = isEventNumeric
        ? { id: String(dto.eventId) }
        : isEventUuid
        ? { publicUuid: String(dto.eventId) }
        : { slug: String(dto.eventId) };

      const event = await queryRunner.manager.findOne(EventEntity, {
        where: eventWhere,
      });
      if (!event || event.status !== 'published') {
        await queryRunner.rollbackTransaction();
        return err('NOT_FOUND');
      }

      // 3. Obtener Función (admite ID numérico, publicUuid o primer show del evento)
      const isShowNumeric = /^\d+$/.test(String(dto.showId));
      const isShowUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(dto.showId),
        );
      let show: ShowEntity | null = null;

      if (isShowNumeric) {
        show = await queryRunner.manager.findOne(ShowEntity, {
          where: { id: String(dto.showId), eventId: event.id },
        });
      } else if (isShowUuid) {
        show = await queryRunner.manager.findOne(ShowEntity, {
          where: { publicUuid: String(dto.showId), eventId: event.id },
        });
      }

      if (!show) {
        show = await queryRunner.manager.findOne(ShowEntity, {
          where: { eventId: event.id },
          order: { startTime: 'ASC' },
        });
      }
      if (!show) {
        await queryRunner.rollbackTransaction();
        return err('NOT_FOUND');
      }

      // 4. Validar Zonas, Aforos y Precios
      let subtotal = 0.0;
      const totalTicketsInOrder = dto.items.reduce((s, it) => s + it.quantity, 0);

      const maxPerEvent = Number(event.userTicketLimit) || 4;
      if (totalTicketsInOrder > maxPerEvent) {
        await queryRunner.rollbackTransaction();
        return err('TICKET_LIMIT_EXCEEDED');
      }

      const zoneItemsResolved: Array<{
        zone: ZoneEntity;
        unitPrice: number;
        tierName: string;
        quantity: number;
      }> = [];

      for (const item of dto.items) {
        if (item.quantity <= 0) continue;

        const isZoneNumeric = /^\d+$/.test(String(item.zoneId));
        const isZoneUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            String(item.zoneId),
          );

        const zoneWhere = isZoneNumeric
          ? { id: String(item.zoneId), eventId: event.id }
          : isZoneUuid
          ? { publicUuid: String(item.zoneId), eventId: event.id }
          : { eventId: event.id };

        const zone = await queryRunner.manager.findOne(ZoneEntity, {
          where: zoneWhere,
          relations: { pricingTiers: true },
        });

        if (!zone) {
          await queryRunner.rollbackTransaction();
          return err('NOT_FOUND');
        }

        // Bloqueo pesimista a nivel de fila de la zona para control de aforo concurrente
        await queryRunner.manager
          .createQueryBuilder(ZoneEntity, 'z')
          .setLock('pessimistic_write')
          .where('z.id = :id', { id: zone.id })
          .getOne();

        const maxPerOrder = Number(zone.maxTicketsPerOrder) || 6;
        if (item.quantity > maxPerOrder) {
          await queryRunner.rollbackTransaction();
          return err('TICKET_LIMIT_EXCEEDED');
        }

        // Límite acumulado por usuario
        const userBoughtInZoneCount = await queryRunner.manager
          .createQueryBuilder(TicketEntity, 't')
          .innerJoin('t.order', 'o')
          .where('t.zoneId = :zoneId', { zoneId: zone.id })
          .andWhere('o.userId = :userId', { userId: user.id })
          .andWhere('o.status = :orderStatus', { orderStatus: 'paid' })
          .andWhere('t.status IN (:...ticketStatuses)', {
            ticketStatuses: ['sold', 'used', 'locked'],
          })
          .getCount();

        const maxPerUserInZone = Number(zone.maxTicketsPerUser) || 10;
        if (userBoughtInZoneCount + item.quantity > maxPerUserInZone) {
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

        // Determinar precio según preventas
        const activeTiers = (zone.pricingTiers || [])
          .filter(
            (t) =>
              t.isActive &&
              (!t.endAt || new Date(t.endAt) >= now) &&
              Number(t.soldCount) < Number(t.capacity),
          )
          .sort((a, b) => a.tierNumber - b.tierNumber);

        const currentTier = activeTiers[0];
        const unitPrice = currentTier
          ? Number(currentTier.price)
          : Number(zone.regularPrice);
        const tierName = currentTier
          ? currentTier.name
          : zone.title || zone.name;

        subtotal += unitPrice * item.quantity;
        zoneItemsResolved.push({
          zone,
          unitPrice,
          tierName,
          quantity: item.quantity,
        });
      }

      // 5. Doble Check Atómico de Cupón
      let discountAmount = 0.0;
      let appliedCoupon: CouponEntity | null = null;

      if (dto.couponCode && dto.couponCode.trim()) {
        const normalizedCode = dto.couponCode.trim().toUpperCase();

        appliedCoupon = await queryRunner.manager
          .createQueryBuilder(CouponEntity, 'c')
          .setLock('pessimistic_write')
          .where('c.eventId = :eventId', { eventId: event.id })
          .andWhere('UPPER(c.code) = :code', { code: normalizedCode })
          .getOne();

        if (!appliedCoupon || !appliedCoupon.isActive) {
          await queryRunner.rollbackTransaction();
          return err('COUPON_INVALID_OR_EXPIRED');
        }

        if (appliedCoupon.startsAt && now < new Date(appliedCoupon.startsAt)) {
          await queryRunner.rollbackTransaction();
          return err('COUPON_INVALID_OR_EXPIRED');
        }
        if (appliedCoupon.expiresAt && now > new Date(appliedCoupon.expiresAt)) {
          await queryRunner.rollbackTransaction();
          return err('COUPON_INVALID_OR_EXPIRED');
        }
        if (
          appliedCoupon.usageType === 'single_use' &&
          Number(appliedCoupon.usedCount) >= 1
        ) {
          await queryRunner.rollbackTransaction();
          return err('COUPON_INVALID_OR_EXPIRED');
        }
        if (
          appliedCoupon.usageType === 'reusable' &&
          appliedCoupon.maxUses !== null &&
          Number(appliedCoupon.usedCount) >= Number(appliedCoupon.maxUses)
        ) {
          await queryRunner.rollbackTransaction();
          return err('COUPON_INVALID_OR_EXPIRED');
        }
        if (
          appliedCoupon.minOrderAmount !== null &&
          subtotal < Number(appliedCoupon.minOrderAmount)
        ) {
          await queryRunner.rollbackTransaction();
          return err('INVALID_INPUT');
        }

        const discountVal = Number(appliedCoupon.discountValue) || 0;
        if (appliedCoupon.discountType === 'percentage') {
          discountAmount =
            Math.round(subtotal * (discountVal / 100) * 100) / 100;
        } else {
          discountAmount = Math.min(subtotal, discountVal);
        }
      }

      const finalTotal = Math.max(
        0,
        Math.round((subtotal - discountAmount) * 100) / 100,
      );

      // 6. Crear Orden Pendiente con 10 minutos de vigencia
      const order = queryRunner.manager.create(OrderEntity, {
        userId: user.id,
        couponId: appliedCoupon ? appliedCoupon.id : null,
        status: 'pending',
        subtotalTickets: subtotal,
        totalServiceFee: 0.0,
        discountAmount: discountAmount,
        totalAmount: finalTotal,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const savedOrder = await queryRunner.manager.save(OrderEntity, order);

      // 7. Retener stock temporalmente (locked_count en zonas) y pre-crear tickets en estado 'locked'
      let ticketCounter = 1;
      for (const resolved of zoneItemsResolved) {
        resolved.zone.lockedCount =
          Number(resolved.zone.lockedCount) + resolved.quantity;
        await queryRunner.manager.save(ZoneEntity, resolved.zone);

        for (let i = 0; i < resolved.quantity; i++) {
          const ticketUuid = randomUUID();
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
            status: 'locked',
          });
          await queryRunner.manager.save(TicketEntity, ticket);
          ticketCounter++;
        }
      }

      // 8. Confirmar orden pendiente en PostgreSQL
      await queryRunner.commitTransaction();

      // 9. Llamar a Izipay para generar el formToken
      const { formToken } = await this.izipayService.createPaymentFormToken(
        savedOrder,
        user,
        event,
      );

      const responseDto = plainToInstance(
        CreateIzipayPaymentResponseDto,
        {
          success: true,
          formToken,
          publicKey: this.izipayService.publicKey,
          orderId: savedOrder.id,
          orderCode: `#QPH-${savedOrder.id.padStart(6, '0')}`,
          orderPublicUuid: savedOrder.publicUuid,
          totalAmount: finalTotal,
          discountAmount,
          couponCode: appliedCoupon ? appliedCoupon.code.toUpperCase() : null,
          clientEndpoint: this.izipayService.clientEndpoint,
        },
        { excludeExtraneousValues: true },
      );

      return ok(responseDto);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error('Error al inicializar pago con Izipay', error);
      return err('INTERNAL_ERROR');
    } finally {
      await queryRunner.release();
    }
  }
}

