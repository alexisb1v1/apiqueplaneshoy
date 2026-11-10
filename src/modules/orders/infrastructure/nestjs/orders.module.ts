import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@auth/auth.module';
import { RedisModule } from '@modules/redis/redis.module';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ZonePricingTierEntity } from '@events/domain/entities/zone-pricing-tier.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { OrdersController } from '../../controllers/orders.controller';
import { CulqiOrdersController } from '../../controllers/culqi-orders.controller';
import { CulqiWebhookController } from '../../controllers/culqi-webhook.controller';
import { SimulateOrderCheckoutHandler } from '../../commands/handlers/simulate-order-checkout.handler';
import { PrepareCulqiCheckoutHandler } from '../../commands/handlers/prepare-culqi-checkout.handler';
import { ConfirmCulqiChargeHandler } from '../../commands/handlers/confirm-culqi-charge.handler';
import { CancelPendingCulqiOrderHandler } from '../../commands/handlers/cancel-pending-culqi-order.handler';
import { GetMyOrdersHandler } from '../../queries/handlers/get-my-orders.handler';
import { ValidateCouponHandler } from '../../queries/handlers/validate-coupon.handler';
import { GetCulqiOrderStatusHandler } from '../../queries/handlers/get-culqi-order-status.handler';
import { CulqiGatewayService } from '../gateways/culqi-gateway.service';
import { OrderLifecycleService } from '../../application/services/order-lifecycle.service';
import { OrderExpirationCronService } from '../../application/services/order-expiration-cron.service';

@Module({
  imports: [
    CqrsModule,
    AuthModule,
    RedisModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      TicketEntity,
      PaymentEntity,
      CouponEntity,
      ZoneEntity,
      ZonePricingTierEntity,
      ShowEntity,
      EventEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    OrdersController,
    CulqiOrdersController,
    CulqiWebhookController,
  ],
  providers: [
    SimulateOrderCheckoutHandler,
    PrepareCulqiCheckoutHandler,
    ConfirmCulqiChargeHandler,
    CancelPendingCulqiOrderHandler,
    GetMyOrdersHandler,
    ValidateCouponHandler,
    GetCulqiOrderStatusHandler,
    CulqiGatewayService,
    OrderLifecycleService,
    OrderExpirationCronService,
  ],
  exports: [TypeOrmModule],
})
export class OrdersModule {}
