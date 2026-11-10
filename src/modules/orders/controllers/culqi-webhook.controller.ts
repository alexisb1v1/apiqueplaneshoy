import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { CulqiGatewayService } from '@orders/infrastructure/gateways/culqi-gateway.service';
import { OrderLifecycleService } from '../application/services/order-lifecycle.service';
import { RedisService } from '@modules/redis/redis.service';

@ApiTags('Webhooks - Culqi')
@Controller('webhooks')
export class CulqiWebhookController {
  private readonly logger = new Logger(CulqiWebhookController.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly culqiGatewayService: CulqiGatewayService,
    private readonly orderLifecycleService: OrderLifecycleService,
    private readonly redisService: RedisService,
  ) {}

  @Post('culqi')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Webhook servidor-a-servidor de Culqi (order.status.changed, charge.creation.succeeded) con verificación activa contra Culqi API v2',
  })
  async handleCulqiWebhook(
    @Req() req: Request,
    @Body() rawBody: Record<string, any>,
  ): Promise<{ received: boolean; duplicated?: boolean }> {
    const authHeader = req.headers?.authorization;
    if (!this.culqiGatewayService.verifyWebhookBasicAuth(authHeader)) {
      throw new UnauthorizedException('Credenciales de webhook inválidas.');
    }

    const eventId = typeof rawBody?.id === 'string' ? rawBody.id : null;
    const eventType = typeof rawBody?.type === 'string' ? rawBody.type : '';

    if (!eventType) {
      return { received: true };
    }

    // Idempotencia rápida en Redis para ignorar reintentos ya completados de Culqi
    if (eventId) {
      const redisKey = `qph:webhook:culqi:${eventId}`;
      const alreadyProcessed = await this.redisService.get<boolean>(redisKey);
      if (alreadyProcessed) {
        return { received: true, duplicated: true };
      }
    }

    const parsedData = this.parseWebhookData(rawBody?.data);

    if (eventType === 'order.status.changed' && parsedData?.id) {
      await this.processOrderStatusWebhook(String(parsedData.id));
    } else if (eventType === 'charge.creation.succeeded' && parsedData?.id) {
      await this.processChargeSucceededWebhook(String(parsedData.id));
    }

    if (eventId) {
      await this.redisService.set(`qph:webhook:culqi:${eventId}`, true, 86400);
    }

    return { received: true };
  }

  private parseWebhookData(rawData: unknown): Record<string, any> | null {
    if (!rawData) return null;
    if (typeof rawData === 'object') return rawData as Record<string, any>;
    if (typeof rawData === 'string') {
      try {
        return JSON.parse(rawData) as Record<string, any>;
      } catch {
        return null;
      }
    }
    return null;
  }

  private async processOrderStatusWebhook(culqiOrderId: string): Promise<void> {
    if (!this.culqiGatewayService.isConfigured()) return;

    const verifyRes = await this.culqiGatewayService.getOrder(culqiOrderId);
    if (!verifyRes.ok) {
      this.logger.warn(
        `[Culqi Webhook] No se pudo verificar orden ${culqiOrderId} contra API oficial: ${verifyRes.message}`,
      );
      return;
    }

    const officialOrder = verifyRes.order;
    const orderPublicUuid = await this.resolveInternalOrderUuid(
      officialOrder.metadata?.qph_order_uuid,
      officialOrder.id,
    );

    if (!orderPublicUuid) {
      this.logger.warn(
        `[Culqi Webhook] Orden Culqi ${officialOrder.id} no está asociada a ninguna orden local conocida.`,
      );
      return;
    }

    if (officialOrder.state === 'paid') {
      await this.orderLifecycleService.finalizePaidOrder({
        orderIdOrUuid: orderPublicUuid,
        paymentMethod: 'culqi_order',
        externalTransactionId: officialOrder.id,
        gatewayResponse: {
          provider: 'culqi',
          culqiOrderId: officialOrder.id,
          culqiOrder: officialOrder,
          confirmedVia: 'webhook',
        },
      });
      return;
    }

    if (officialOrder.state === 'expired' || officialOrder.state === 'deleted') {
      const payment = await this.paymentRepository.findOne({
        where: { externalTransactionId: officialOrder.id },
      });
      if (payment) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          await this.orderLifecycleService.releasePendingOrder(
            queryRunner.manager,
            payment.orderId,
            'expired',
          );
          await queryRunner.commitTransaction();
        } catch {
          await queryRunner.rollbackTransaction();
        } finally {
          await queryRunner.release();
        }
      }
    }
  }

  private async processChargeSucceededWebhook(culqiChargeId: string): Promise<void> {
    if (!this.culqiGatewayService.isConfigured()) return;

    const verifyRes = await this.culqiGatewayService.getCharge(culqiChargeId);
    if (!verifyRes.ok) {
      this.logger.warn(
        `[Culqi Webhook] No se pudo verificar cargo ${culqiChargeId} contra API oficial.`,
      );
      return;
    }

    const officialCharge = verifyRes.charge;
    const isApproved =
      !officialCharge.outcome?.type || officialCharge.outcome.type === 'venta_exitosa';

    if (!isApproved) return;

    const orderPublicUuid = await this.resolveInternalOrderUuid(
      officialCharge.metadata?.qph_order_uuid,
      typeof officialCharge.metadata?.culqi_order_id === 'string'
        ? officialCharge.metadata.culqi_order_id
        : undefined,
    );

    if (!orderPublicUuid) {
      return;
    }

    const resolvedMethod =
      officialCharge.source?.object === 'yape' ? 'yape' : 'card';

    await this.orderLifecycleService.finalizePaidOrder({
      orderIdOrUuid: orderPublicUuid,
      paymentMethod: resolvedMethod,
      externalTransactionId: officialCharge.id,
      gatewayResponse: {
        provider: 'culqi',
        culqiOrderId: officialCharge.metadata?.culqi_order_id || null,
        culqiChargeId: officialCharge.id,
        culqiCharge: officialCharge,
        confirmedVia: 'webhook',
      },
    });
  }

  private async resolveInternalOrderUuid(
    metadataUuid: unknown,
    culqiOrderId?: string,
  ): Promise<string | null> {
    if (typeof metadataUuid === 'string' && metadataUuid.trim()) {
      return metadataUuid.trim();
    }

    if (culqiOrderId) {
      const payment = await this.paymentRepository.findOne({
        where: { externalTransactionId: culqiOrderId },
        relations: { order: true },
      });
      if (payment?.order?.publicUuid) {
        return payment.order.publicUuid;
      }
    }

    return null;
  }
}

