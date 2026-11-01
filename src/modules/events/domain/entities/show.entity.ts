import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { EventEntity } from './event.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';

@Entity('shows')
@Index(['eventId', 'startTime'])
export class ShowEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental de la función' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID de la función para el cliente' })
  publicUuid: string;

  @Index()
  @Column({ name: 'event_id', type: 'bigint', comment: 'ID del evento al que pertenece esta función' })
  eventId: string;

  @Column({ type: 'varchar', length: 150, nullable: true, comment: 'Nombre o título de la función (ej: Noche de Apertura)' })
  name: string | null;

  @Index()
  @Column({ name: 'start_time', type: 'timestamptz', comment: 'Fecha y hora exacta de inicio de la función o apertura de puertas' })
  startTime: Date;

  @Column({ name: 'sales_end_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora límite de venta de entradas para esta función (si es null, cierra en start_time)' })
  salesEndAt: Date | null;

  @Column({ name: 'duration_hours', type: 'integer', nullable: true, default: 2, comment: 'Duración estimada del evento en horas (1, 2, 3, etc.)' })
  durationHours: number | null;

  @Index()
  @Column({ length: 50, default: 'scheduled', comment: 'Estado del show: scheduled, ongoing, completed, cancelled' })
  status: string;

  // Relaciones
  @ManyToOne(() => EventEntity, (event) => event.shows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;

  @OneToMany(() => TicketEntity, (ticket) => ticket.show)
  tickets: TicketEntity[];
}
