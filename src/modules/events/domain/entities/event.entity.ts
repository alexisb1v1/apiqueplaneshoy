import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserEntity } from '@users/domain/entities/user.entity';
import { EventImageEntity } from './event-image.entity';
import { ShowEntity } from './show.entity';
import { ZoneEntity } from './zone.entity';

@Entity('events')
export class EventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // Mapeado a string en TS para evitar overflow de bigint

  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()' })
  publicUuid: string;

  @Column({ name: 'organizer_id', type: 'integer' })
  organizerId: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'user_ticket_limit', type: 'integer', default: 4 })
  userTicketLimit: number;

  @Column({ length: 50, default: 'draft' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => UserEntity, (user) => user.events, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: UserEntity;

  @OneToMany(() => EventImageEntity, (image) => image.event)
  images: EventImageEntity[];

  @OneToMany(() => ShowEntity, (show) => show.event)
  shows: ShowEntity[];

  @OneToMany(() => ZoneEntity, (zone) => zone.event)
  zones: ZoneEntity[];
}
