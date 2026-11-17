import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { GetCulqiOrderStatusQuery } from '../impl/get-culqi-order-status.query';
import { CulqiOrderStatusResponseDto } from '../../dto/culqi-order-status.response.dto';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { CulqiGatewayService } from '@orders/infrastructure/gateways/culqi-gateway.service';
import { OrderLifecycleService } from '../../application/services/order-lifecycle.service';

@QueryHandler(GetCulqiOrderStatusQuery)
export class GetCulqiOrderStatusHandler
  implements IQueryHandler<GetCulqiOrderStatusQuery, Result<CulqiOrderStatusResponseDto, AppError>>
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
   * Consulta el estado actualizado de la orden en PostgreSQL y sincroniza en vivo con Culqi API v2
   * para pagos asíncronos (Billeteras QR, PagoEfectivo CIP, Cuotéalo BCP).
   *
   * @param query - UUID público de la orden y usuario autenticado
   * @returns Estado consolidado de la orden con boletos si ya fue liquidada
   */
  async execute(
    query: GetCulqiOrderStatusQuery,
  ): Promise<Result<CulqiOrderStatusResponseDto, AppError>> {
    const order = await this.orderRepository.findOne({
      where: { publicUuid: query.orderPublicUuid },
    });

    if (!order) {
      return err('NOT_FOUND');
    }

    if (Number(order.userId) !== Number(query.authenticatedUserId)) {
      return err('FORBIDDEN');
    }

    const payment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
      order: { id: 'DESC' },
    });

    if (order.status === 'paid') {
      const finalized = await this.orderLifecycleService.finalizePaidOrder({
        orderIdOrUuid: order.publicUuid,
        paymentMethod: payment?.paymentMethod || 'culqi_order',
        externalTransactionId: payment?.externalTransactionId || `TX-${order.id}`,
        gatewayResponse: { provider: 'culqi' },
      });

      if (finalized.isErr()) {
        return err(finalized.error);
      }

      return ok(
        plainToInstance(
          CulqiOrderStatusResponseDto,
          {
            orderPublicUuid: order.publicUuid,
            status: 'paid',
            culqiState: 'paid',
            paymentCode: (payment?.gatewayResponse?.culqiOrder?.payment_code as string) || null,
            expiresAt: order.expiresAt?.toISOString() || null,
            checkoutResult: finalized.value,
          },
          { excludeExtraneousValues: true },
        ),
      );
    }

    if (order.status !== 'pending') {
      return ok(
        plainToInstance(
          CulqiOrderStatusResponseDto,
          {
            orderPublicUuid: order.publicUuid,
            status: order.status,
            culqiState: order.status,
            paymentCode: null,
            expiresAt: order.expiresAt?.toISOString() || null,
            checkoutResult: null,
          },
          { excludeExtraneousValues: true },
        ),
      );
    }

    const culqiOrderId =
      (payment?.gatewayResponse?.culqiOrderId as string | undefined) ||
      (payment?.externalTransactionId?.startsWith('ord_')
        ? payment.externalTransactionId
        : undefined);

    let culqiState: string | null = 'pending';
    let paymentCode: string | null =
      (payment?.gatewayResponse?.culqiOrder?.payment_code as string | undefined) || null;

    if (culqiOrderId && this.culqiGatewayService.isConfigured()) {
      const culqiOrderRes = await this.culqiGatewayService.getOrder(culqiOrderId);
      if (culqiOrderRes.ok) {
        culqiState = culqiOrderRes.order.state;
        paymentCode = culqiOrderRes.order.payment_code || paymentCode;

        if (culqiOrderRes.order.state === 'paid') {
          const finalized = await this.orderLifecycleService.finalizePaidOrder({
            orderIdOrUuid: order.publicUuid,
            paymentMethod: payment?.paymentMethod || 'culqi_order',
            externalTransactionId: culqiOrderRes.order.id,
            gatewayResponse: {
              provider: 'culqi',
              culqiOrderId: culqiOrderRes.order.id,
              culqiOrder: culqiOrderRes.order,
            },
          });

          if (finalized.isOk()) {
            return ok(
              plainToInstance(
                CulqiOrderStatusResponseDto,
                {
                  orderPublicUuid: order.publicUuid,
                  status: 'paid',
                  culqiState: 'paid',
                  paymentCode,
                  expiresAt: order.expiresAt?.toISOString() || null,
                  checkoutResult: finalized.value,
                },
                { excludeExtraneousValues: true },
              ),
            );
          }
        }

        if (culqiOrderRes.order.state === 'expired' || culqiOrderRes.order.state === 'deleted') {
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

          return ok(
            plainToInstance(
              CulqiOrderStatusResponseDto,
              {
                orderPublicUuid: order.publicUuid,
                status: 'expired',
                culqiState: culqiOrderRes.order.state,
                paymentCode,
                expiresAt: order.expiresAt?.toISOString() || null,
                checkoutResult: null,
              },
              { excludeExtraneousValues: true },
            ),
          );
        }
      }
    }

    return ok(
      plainToInstance(
        CulqiOrderStatusResponseDto,
        {
          orderPublicUuid: order.publicUuid,
          status: 'pending',
          culqiState,
          paymentCode,
          expiresAt: order.expiresAt?.toISOString() || null,
          checkoutResult: null,
        },
        { excludeExtraneousValues: true },
      ),
    );
  }
}

