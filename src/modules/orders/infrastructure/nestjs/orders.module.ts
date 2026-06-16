import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { PaymentEntity } from '@orders/domain/entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, TicketEntity, PaymentEntity]),
  ],
  exports: [
    TypeOrmModule,
  ],
})
export class OrdersModule {}
