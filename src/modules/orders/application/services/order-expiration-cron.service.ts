import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { OrderLifecycleService } from './order-lifecycle.service';
import { CulqiGatewayService } from '@orders/infrastructure/gateways/culqi-gateway.service';

@Injectable()
export class OrderExpirationCronService {
  private readonly logger = new Logger(OrderExpirationCronService.name);
  private isRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly orderLifecycleService: OrderLifecycleService,
    private readonly culqiGatewayService: CulqiGatewayService,
  ) {}

  /**
   * Audita cada minuto las órdenes pendientes cuyo tiempo límite expiró y libera el stock bloqueado.
   * Antes de expirar una orden con sesión Culqi activa, verifica su estado oficial en Culqi para evitar falsos expirados.
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'release-expired-pending-orders',
  })
  async handleExpiredPendingOrders(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      const expiredOrders = await this.orderRepository.find({
        where: {
          status: 'pending',
          expiresAt: LessThan(now),
        },
        take: 50,
        order: { expiresAt: 'ASC' },
      });

      if (!expiredOrders.length) return;

      for (const order of expiredOrders) {
        await this.processExpiredOrder(order);
      }
    } catch (error: any) {
      this.logger.error(
        `[Cron Órdenes] Error liberando órdenes pendientes expiradas: ${error?.message || error}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async processExpiredOrder(order: OrderEntity): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
      order: { id: 'DESC' },
    });

    const culqiOrderId =
      (payment?.gatewayResponse?.culqiOrderId as string | undefined) ||
      (payment?.externalTransactionId?.startsWith('ord_')
        ? payment.externalTransactionId
        : undefined);

    if (culqiOrderId && this.culqiGatewayService.isConfigured()) {
      const culqiCheck = await this.culqiGatewayService.getOrder(culqiOrderId);
      if (culqiCheck.ok && culqiCheck.order.state === 'paid') {
        await this.orderLifecycleService.finalizePaidOrder({
          orderIdOrUuid: order.id,
          paymentMethod: payment?.paymentMethod || 'culqi_order',
          externalTransactionId: culqiCheck.order.id,
          gatewayResponse: {
            provider: 'culqi',
            culqiOrderId: culqiCheck.order.id,
            culqiOrder: culqiCheck.order,
            reconciledByCron: true,
          },
        });
        return;
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const released = await this.orderLifecycleService.releasePendingOrder(
        queryRunner.manager,
        order.id,
        'expired',
      );
      await queryRunner.commitTransaction();
      if (released) {
        this.logger.log(
          `[Cron Órdenes] Orden #${order.id} (${order.publicUuid}) expirada y stock liberado.`,
        );
      }
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.warn(
        `[Cron Órdenes] No se pudo expirar orden #${order.id}: ${error?.message || error}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}

