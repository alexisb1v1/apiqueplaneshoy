import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { OrderEntity } from './order.entity';

@Entity('coupons')
@Index(['eventId', 'code'], { unique: true })
export class CouponEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental del cupón' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID del cupón' })
  publicUuid: string;

  @Index()
  @Column({ name: 'event_id', type: 'bigint', comment: 'ID del evento al que pertenece y aplica este cupón' })
  eventId: string;

  @Index()
  @Column({ name: 'organizer_id', type: 'integer', comment: 'ID del usuario organizador que creó el cupón' })
  organizerId: number;

  @Index()
  @Column({ length: 50, comment: 'Código alfanumérico que escribe el comprador (ej: INFLUENCER10, CYBER20)' })
  code: string;

  @Column({ name: 'discount_type', length: 20, comment: 'Tipo de descuento: percentage (% de rebaja) o fixed (monto fijo en soles)' })
  discountType: string;

  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2, comment: 'Magnitud del descuento (ej: 15.00 para 15% o 20.00 para S/ 20.00)' })
  discountValue: number;

  @Column({ name: 'usage_type', length: 20, default: 'single_use', comment: 'Modalidad de uso: single_use (de 1 solo uso) o reusable (múltiples canjes)' })
  usageType: string;

  @Column({ name: 'max_uses', type: 'integer', nullable: true, comment: 'Límite máximo total de canjes permitidos en la plataforma (null si es ilimitado)' })
  maxUses: number | null;

  @Column({ name: 'used_count', type: 'integer', default: 0, comment: 'Cantidad acumulada de órdenes pagadas que han canjeado este cupón' })
  usedCount: number;

  @Column({ name: 'min_order_amount', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Monto mínimo de subtotal de compra requerido para aplicar el beneficio' })
  minOrderAmount: number | null;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora en que empieza la vigencia del cupón' })
  startsAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora límite de vencimiento (null si dura hasta el fin del evento)' })
  expiresAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true, comment: 'Permite pausar o cancelar anticipadamente la vigencia del cupón' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora de creación del cupón' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => EventEntity, (event) => event.coupons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: UserEntity;

  @OneToMany(() => OrderEntity, (order) => order.coupon)
  orders: OrderEntity[];
}
