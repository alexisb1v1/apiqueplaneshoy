import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './user.entity';
import { EventEntity } from '@events/domain/entities/event.entity';

@Entity('user_favorite_events')
@Index(['userId', 'eventId'], { unique: true })
export class UserFavoriteEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental del favorito' })
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'integer', comment: 'ID del usuario que guardó el evento como favorito' })
  userId: number;

  @Index()
  @Column({ name: 'event_id', type: 'bigint', comment: 'ID del evento marcado como favorito' })
  eventId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora en que se agregó a la lista de favoritos' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => UserEntity, (user) => user.favorites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => EventEntity, (event) => event.favorites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;
}
