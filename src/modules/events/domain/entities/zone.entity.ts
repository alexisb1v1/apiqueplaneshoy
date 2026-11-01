import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { EventEntity } from './event.entity';
import { ZonePricingTierEntity } from './zone-pricing-tier.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';

@Entity('zones')
export class ZoneEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental de la zona' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID de la localidad para compra' })
  publicUuid: string;

  @Index()
  @Column({ name: 'event_id', type: 'bigint', comment: 'ID del evento al que pertenece esta configuración de zona' })
  eventId: string;

  @Column({ length: 100, comment: 'Nombre comercial de la localidad o sector (ej: VIP, General, Box)' })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true, comment: 'Título comercial destacado (ej: Experiencia VIP Box, Primera Fila)' })
  title: string | null;

  @Column({ length: 7, default: '#3B82F6', comment: 'Color hexadecimal distintivo de la zona (ej: #EF4444 para VIP, #10B981 para General)' })
  color: string;

  @Column({ type: 'text', nullable: true, comment: 'Descripción de la ubicación física en el recinto y beneficios incluidos' })
  benefits: string | null;

  @Column({ type: 'integer', comment: 'Capacidad máxima de personas o aforo total de esta zona' })
  capacity: number;

  @Column({ name: 'sold_count', type: 'integer', default: 0, comment: 'Cantidad acumulada de boletos pagados y confirmados en esta zona' })
  soldCount: number;

  @Column({ name: 'locked_count', type: 'integer', default: 0, comment: 'Cantidad de boletos retenidos temporalmente en sesiones activas de checkout' })
  lockedCount: number;

  @Column({ name: 'regular_price', type: 'decimal', precision: 10, scale: 2, comment: 'Precio regular oficial de venta general de la localidad (precio de lista / taquilla)' })
  regularPrice: number;

  @Column({ name: 'service_fee', type: 'decimal', precision: 10, scale: 2, default: 0.00, comment: 'Cargo o comisión por servicio de ticketera por boleto' })
  serviceFee: number;

  @Column({ name: 'max_tickets_per_order', type: 'integer', default: 6, comment: 'Cantidad máxima de entradas que un cliente puede comprar en una sola transacción/checkout' })
  maxTicketsPerOrder: number;

  @Column({ name: 'max_tickets_per_user', type: 'integer', default: 10, comment: 'Límite máximo acumulado de entradas en esta zona que un mismo usuario puede comprar en el evento' })
  maxTicketsPerUser: number;

  @Column({ name: 'sales_start_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora en que inicia la venta de entradas de esta zona' })
  salesStartAt: Date | null;

  // Relaciones
  @ManyToOne(() => EventEntity, (event) => event.zones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;

  @OneToMany(() => ZonePricingTierEntity, (tier) => tier.zone)
  pricingTiers: ZonePricingTierEntity[];

  @OneToMany(() => TicketEntity, (ticket) => ticket.zone)
  tickets: TicketEntity[];
}
