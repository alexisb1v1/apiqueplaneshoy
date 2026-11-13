import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { UserEntity } from '@users/domain/entities/user.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { TicketEntity } from './ticket.entity';
import { PaymentEntity } from './payment.entity';
import { CouponEntity } from './coupon.entity';

@Entity('orders')
@Index(['status', 'expiresAt'])
export class OrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental de la orden' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Token público UUID de la orden para el checkout' })
  publicUuid: string;

  @Index()
  @Column({ name: 'user_id', type: 'integer', comment: 'ID del usuario comprador que generó esta orden' })
  userId: number;

  @Index()
  @Column({ name: 'event_id', type: 'bigint', nullable: true, comment: 'ID del evento al que corresponde esta orden de compra' })
  eventId: string | null;

  @Index()
  @Column({ name: 'coupon_id', type: 'bigint', nullable: true, comment: 'ID del cupón de descuento aplicado a esta orden (si corresponde)' })
  couponId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'pending', comment: 'Estado de la orden: pending, paid, expired, cancelled, refunded' })
  status: string;

  @Column({ name: 'subtotal_tickets', type: 'decimal', precision: 10, scale: 2, default: 0.00, comment: 'Suma de los precios base de los tickets reservados' })
  subtotalTickets: number;

  @Column({ name: 'total_service_fee', type: 'decimal', precision: 10, scale: 2, default: 0.00, comment: 'Suma de los cargos por servicio aplicados' })
  totalServiceFee: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0.00, comment: 'Monto de descuento aplicado por el cupón canjeado' })
  discountAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0.00, comment: 'Monto final total a cobrar al cliente (subtotal + service_fee - discount_amount)' })
  totalAmount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora exacta de creación de la reserva' })
  createdAt: Date;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', comment: 'Fecha y hora límite de expiración de la reserva si no se paga (10 minutos)' })
  expiresAt: Date;

  // Relaciones
  @ManyToOne(() => UserEntity, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => EventEntity, (event) => event.orders, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity | null;

  @ManyToOne(() => CouponEntity, (coupon) => coupon.orders, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'coupon_id' })
  coupon: CouponEntity | null;

  @OneToMany(() => TicketEntity, (ticket) => ticket.order)
  tickets: TicketEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.order)
  payments: PaymentEntity[];
}
