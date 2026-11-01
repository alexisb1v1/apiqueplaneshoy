import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { EventEntity } from './event.entity';

@Entity('event_images')
@Index(['eventId', 'sortOrder'])
export class EventImageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno de la imagen' })
  id: string;

  @Index()
  @Column({ name: 'event_id', type: 'bigint', comment: 'ID del evento al que pertenece esta imagen' })
  eventId: string;

  @Column({ name: 'image_url', length: 512, comment: 'URL pública de la imagen alojada en CDN o almacenamiento en la nube' })
  imageUrl: string;

  @Index()
  @Column({ name: 'image_type', length: 50, default: 'gallery', comment: 'Tipo o clasificación de la imagen: banner (principal), gallery (galería), zone_map (mapa de zonas/croquis)' })
  imageType: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0, comment: 'Posición numérica para ordenar en la galería del evento' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora en que se registró la imagen' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => EventEntity, (event) => event.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;
}
