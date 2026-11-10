import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { AppError } from '@common/errors/app-errors';
import { CancelPendingCulqiOrderCommand } from '../impl/cancel-pending-culqi-order.command';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { CulqiGatewayService } from '@orders/infrastructure/gateways/culqi-gateway.service';
import { OrderLifecycleService } from '../../application/services/order-lifecycle.service';

export interface CancelPendingOrderResult {
  released: boolean;
  status: string;
}

@CommandHandler(CancelPendingCulqiOrderCommand)
export class CancelPendingCulqiOrderHandler
  implements
    ICommandHandler<CancelPendingCulqiOrderCommand, Result<CancelPendingOrderResult, AppError>>
{
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly culqiGatewayService: CulqiGatewayService,
    private readonly orderLifecycleService: OrderLifecycleService,
  ) {}

  /**
   * Libera el stock de una orden pendiente si el comprador cerró el checkout sin completar el pago.
   *
   * @param command - UUID público de la orden y usuario propietario
   * @returns Confirmación de liberación o error de propiedad/existencia
   */
  async execute(
    command: CancelPendingCulqiOrderCommand,
  ): Promise<Result<CancelPendingOrderResult, AppError>> {
    const order = await this.orderRepository.findOne({
      where: { publicUuid: command.orderPublicUuid },
    });

    if (!order) {
      return err('NOT_FOUND');
    }

    if (Number(order.userId) !== Number(command.authenticatedUserId)) {
      return err('FORBIDDEN');
    }

    if (order.status !== 'pending') {
      return ok({ released: false, status: order.status });
    }

    // Comprobar antes en Culqi si la orden ya se pagó para evitar cancelar un pago recién completado
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
      const culqiOrderRes = await this.culqiGatewayService.getOrder(culqiOrderId);
      if (culqiOrderRes.ok && culqiOrderRes.order.state === 'paid') {
        await this.orderLifecycleService.finalizePaidOrder({
          orderIdOrUuid: order.publicUuid,
          paymentMethod: payment?.paymentMethod || 'culqi_order',
          externalTransactionId: culqiOrderRes.order.id,
          gatewayResponse: {
            provider: 'culqi',
            culqiOrderId: culqiOrderRes.order.id,
            culqiOrder: culqiOrderRes.order,
          },
        });
        return ok({ released: false, status: 'paid' });
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const released = await this.orderLifecycleService.releasePendingOrder(
        queryRunner.manager,
        order.id,
        'cancelled',
      );
      await queryRunner.commitTransaction();
      return ok({ released, status: released ? 'cancelled' : order.status });
    } catch {
      await queryRunner.rollbackTransaction();
      return err('INTERNAL_ERROR');
    } finally {
      await queryRunner.release();
    }
  }
}

