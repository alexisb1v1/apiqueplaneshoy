import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { ZoneEntity } from './zone.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';

@Entity('zone_pricing_tiers')
@Index(['zoneId', 'tierNumber'], { unique: true })
export class ZonePricingTierEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental del tier de preventa' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID del tier de preventa' })
  publicUuid: string;

  @Index()
  @Column({ name: 'zone_id', type: 'bigint', comment: 'ID de la zona a la que pertenece este escalón de preventa' })
  zoneId: string;

  @Column({ name: 'tier_number', type: 'smallint', comment: 'Número ordinal de preventa: 1 para Preventa 1, 2 para Preventa 2, 3 para Preventa 3' })
  tierNumber: number;

  @Column({ length: 100, comment: 'Nombre comercial de la fase (ej: Preventa 1 - Early Bird, Preventa 2 - Fans)' })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: 'Precio con descuento promocional aplicable a esta fase' })
  price: number;

  @Column({ type: 'integer', comment: 'Cupo o stock máximo de boletos asignados exclusivamente a esta preventa' })
  capacity: number;

  @Column({ name: 'sold_count', type: 'integer', default: 0, comment: 'Cantidad acumulada de boletos pagados y confirmados en este tier' })
  soldCount: number;

  @Column({ name: 'locked_count', type: 'integer', default: 0, comment: 'Cantidad de boletos apartados temporalmente en checkout activo en este tier' })
  lockedCount: number;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora límite de vigencia (al vencer o agotarse, conmuta a la siguiente fase o regular_price)' })
  endAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true, comment: 'Flag para activar o pausar anticipadamente esta fase de preventa' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha de creación del tier' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => ZoneEntity, (zone) => zone.pricingTiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'zone_id' })
  zone: ZoneEntity;

  @OneToMany(() => TicketEntity, (ticket) => ticket.pricingTier)
  tickets: TicketEntity[];
}
