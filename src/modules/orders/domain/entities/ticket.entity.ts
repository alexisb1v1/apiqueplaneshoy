import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { OrderEntity } from './order.entity';

@Entity('tickets')
export class TicketEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // Mapeado a string en TS para evitar overflow de bigint

  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()' })
  publicUuid: string;

  @Column({ name: 'show_id', type: 'bigint' })
  showId: string;

  @Column({ name: 'zone_id', type: 'bigint' })
  zoneId: string;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @Column({ name: 'order_id', type: 'bigint', nullable: true })
  orderId: string | null;

  @Column({ name: 'paid_base_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  paidBasePrice: number | null;

  @Column({ name: 'paid_service_fee', type: 'decimal', precision: 10, scale: 2, nullable: true })
  paidServiceFee: number | null;

  @Column({ name: 'qr_code', type: 'varchar', length: 255, nullable: true, unique: true })
  qrCode: string | null;

  @Column({ length: 50, default: 'available' })
  status: string;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  // Relaciones
  @ManyToOne(() => ShowEntity, (show) => show.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'show_id' })
  show: ShowEntity;

  @ManyToOne(() => ZoneEntity, (zone) => zone.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'zone_id' })
  zone: ZoneEntity;

  @ManyToOne(() => UserEntity, (user) => user.tickets, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;

  @ManyToOne(() => OrderEntity, (order) => order.tickets, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity | null;
}
