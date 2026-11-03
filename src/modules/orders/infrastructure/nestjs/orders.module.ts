import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@auth/auth.module';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { OrdersController } from '../../controllers/orders.controller';
import { SimulateOrderCheckoutHandler } from '../../commands/handlers/simulate-order-checkout.handler';
import { GetMyOrdersHandler } from '../../queries/handlers/get-my-orders.handler';

@Module({
  imports: [
    CqrsModule,
    AuthModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      TicketEntity,
      PaymentEntity,
      CouponEntity,
      ZoneEntity,
      ShowEntity,
      EventEntity,
      UserEntity,
    ]),
  ],
  controllers: [OrdersController],
  providers: [SimulateOrderCheckoutHandler, GetMyOrdersHandler],
  exports: [TypeOrmModule],
})
export class OrdersModule {}
