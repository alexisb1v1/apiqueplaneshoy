import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { EventEntity } from './event.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';

@Entity('zones')
export class ZoneEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // Mapeado a string en TS para evitar overflow de bigint

  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()' })
  publicUuid: string;

  @Column({ name: 'event_id', type: 'bigint' })
  eventId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'integer' })
  capacity: number;

  @Column({ name: 'base_price', type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ name: 'service_fee', type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  serviceFee: number;

  // Relaciones
  @ManyToOne(() => EventEntity, (event) => event.zones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;

  @OneToMany(() => TicketEntity, (ticket) => ticket.zone)
  tickets: TicketEntity[];
}
