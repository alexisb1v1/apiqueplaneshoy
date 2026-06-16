import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { EventEntity } from './event.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';

@Entity('shows')
export class ShowEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // Mapeado a string en TS para evitar overflow de bigint

  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()' })
  publicUuid: string;

  @Column({ name: 'event_id', type: 'bigint' })
  eventId: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @Column({ length: 50, default: 'scheduled' })
  status: string;

  // Relaciones
  @ManyToOne(() => EventEntity, (event) => event.shows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;

  @OneToMany(() => TicketEntity, (ticket) => ticket.show)
  tickets: TicketEntity[];
}
