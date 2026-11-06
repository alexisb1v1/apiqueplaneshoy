import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ShowEntity } from '@events/domain/entities/show.entity';
import { ZoneEntity } from '@events/domain/entities/zone.entity';
import { ZonePricingTierEntity } from '@events/domain/entities/zone-pricing-tier.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { OrderEntity } from './order.entity';

@Entity('tickets')
@Index(['showId', 'zoneId'])
@Index(['pricingTierId', 'status'])
@Index(['status', 'lockedUntil'])
export class TicketEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental del boleto' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID del boleto para billetera digital' })
  publicUuid: string;

  @Index()
  @Column({ name: 'show_id', type: 'bigint', comment: 'ID de la función o show específico al que da acceso' })
  showId: string;

  @Index()
  @Column({ name: 'zone_id', type: 'bigint', comment: 'ID de la zona o sección física a la que pertenece' })
  zoneId: string;

  @Index()
  @Column({ name: 'pricing_tier_id', type: 'bigint', nullable: true, comment: 'ID de la preventa en la que se adquirió el ticket (null si fue al precio regular)' })
  pricingTierId: string | null;

  @Index()
  @Column({ name: 'user_id', type: 'integer', nullable: true, comment: 'ID del usuario comprador (null si no se ha vendido)' })
  userId: number | null;

  @Index()
  @Column({ name: 'order_id', type: 'bigint', nullable: true, comment: 'ID de la orden de compra donde se adquirió' })
  orderId: string | null;

  @Column({ name: 'paid_base_price', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Precio base pagado congelado al momento de compra (refleja el tier o regular)' })
  paidBasePrice: number | null;

  @Column({ name: 'paid_service_fee', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Cargo por servicio pagado congelado al momento de compra' })
  paidServiceFee: number | null;

  @Index({ unique: true })
  @Column({ name: 'qr_code', type: 'varchar', length: 255, nullable: true, unique: true, comment: 'Token criptográfico único firmado con Ed25519 para escaneo en puerta' })
  qrCode: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'available', comment: 'Estado del ticket: available, locked, sold, used, cancelled' })
  status: string;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true, comment: 'Marca de tiempo hasta la que el ticket está retenido durante la compra (10 min)' })
  lockedUntil: Date | null;

  @Column({ name: 'scanned_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora exacta en que el código QR fue validado y consumido en puerta' })
  scannedAt: Date | null;

  // Relaciones
  @ManyToOne(() => ShowEntity, (show) => show.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'show_id' })
  show: ShowEntity;

  @ManyToOne(() => ZoneEntity, (zone) => zone.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'zone_id' })
  zone: ZoneEntity;

  @ManyToOne(() => ZonePricingTierEntity, (tier) => tier.tickets, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pricing_tier_id' })
  pricingTier: ZonePricingTierEntity | null;

  @ManyToOne(() => UserEntity, (user) => user.tickets, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;

  @ManyToOne(() => OrderEntity, (order) => order.tickets, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity | null;
}
