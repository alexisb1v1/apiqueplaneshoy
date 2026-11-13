import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from '@users/domain/entities/user.entity';
import { EventImageEntity } from './event-image.entity';
import { ShowEntity } from './show.entity';
import { ZoneEntity } from './zone.entity';
import { EventAdvanceEntity } from './event-advance.entity';
import { EventSettlementEntity } from './event-settlement.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { UserFavoriteEventEntity } from '@users/domain/entities/user-favorite-event.entity';

@Entity('events')
@Index(['status', 'name'])
export class EventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental del evento' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID para URLs y APIs' })
  publicUuid: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150, unique: true, comment: 'Slug alfanumérico amigable único para URL pública del evento y posicionamiento SEO' })
  slug: string;

  @Index()
  @Column({ name: 'has_landing_page', type: 'boolean', default: false, comment: 'Indica si el evento tiene habilitada la experiencia de Landing Page personalizada' })
  hasLandingPage: boolean;

  @Index()
  @Column({ name: 'is_featured', type: 'boolean', default: false, comment: 'Indica si el evento está destacado para el Hero Carousel de portada' })
  isFeatured: boolean;

  @Index()
  @Column({ name: 'organizer_id', type: 'integer', comment: 'ID del usuario organizador que creó el evento' })
  organizerId: number;

  @Index()
  @Column({ type: 'varchar', length: 255, comment: 'Nombre o título comercial del evento' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: 'Descripción detallada o sinopsis del espectáculo' })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'CONCERTS', comment: 'Categoría o tipo de evento: CONCERTS, THEATER, SPORTS, FESTIVALS, COMEDY, GASTRONOMY' })
  category: string;

  @Column('text', { array: true, default: '{}', nullable: true, comment: 'Etiquetas o tags de búsqueda del evento' })
  tags: string[] | null;

  @Index()
  @Column({ name: 'age_restriction', type: 'varchar', length: 50, default: 'ALL_AGES', comment: 'Público objetivo y restricción de edad: ALL_AGES, PLUS_14, PLUS_18' })
  ageRestriction: string;

  @Column({ name: 'terms_and_conditions_url', type: 'varchar', length: 512, nullable: true, comment: 'URL del documento PDF oficial descargable con los términos y bases legales' })
  termsAndConditionsUrl: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: 'Arreglo estructurado de preguntas frecuentes del evento: [{ question, answer }]' })
  faqs: Array<{ question: string; answer: string }> | null;

  @Column({ name: 'landing_config', type: 'jsonb', nullable: true, comment: 'Configuración visual de la landing del evento: colores, tema, imagen cabecera, CTA y croquis de zonas' })
  landingConfig: Record<string, any> | null;

  @Column({ name: 'promo_video_url', type: 'varchar', length: 512, nullable: true, comment: 'URL del video promocional o teaser oficial del evento (YouTube, Vimeo o MP4 directo)' })
  promoVideoUrl: string | null;

  @Column({ name: 'social_links', type: 'jsonb', nullable: true, comment: 'Enlaces a redes sociales oficiales del evento: { instagramUrl, facebookUrl, tiktokUrl }' })
  socialLinks: {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    tiktokUrl?: string | null;
  } | null;

  @Column({ name: 'ubigeo_code', type: 'varchar', length: 6, nullable: true, comment: 'Código de ubigeo INEI de 6 dígitos (dep-prov-distrito)' })
  ubigeoCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Nombre comercial del recinto, estadio, teatro o local (ej: Explanada Ferial, Teatro Municipal)' })
  venue: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Dirección física exacta donde se llevará a cabo el evento' })
  address: string | null;

  @Column({ name: 'address_reference', type: 'varchar', length: 255, nullable: true, comment: 'Referencia geográfica para llegar al recinto (ej: Frente al CC Real Plaza)' })
  addressReference: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Coordenadas geográficas unificadas en formato lat, lng' })
  coordinates: string | null;

  @Column({ name: 'google_maps_url', type: 'varchar', length: 512, nullable: true, comment: 'Enlace web directo a Google Maps o Waze para navegación móvil' })
  googleMapsUrl: string | null;

  @Column({ name: 'entry_requirements', type: 'text', nullable: true, comment: 'Requisitos y restricciones de entrada (documentos, vestimenta, objetos prohibidos)' })
  entryRequirements: string | null;

  @Column({ name: 'opening_hours_comment', type: 'text', nullable: true, comment: 'Instrucciones y comentarios sobre horarios de apertura de puertas y recomendaciones de llegada' })
  openingHoursComment: string | null;

  @Column({ name: 'user_ticket_limit', type: 'integer', default: 6, comment: 'Límite global acumulado de entradas por usuario en todo el evento' })
  userTicketLimit: number;

  @Column({ name: 'signing_key_id', type: 'varchar', length: 64, default: () => 'gen_random_uuid()', comment: 'Identificador del par de llaves criptográficas del evento para rotación y revocación' })
  signingKeyId: string;

  @Column({ name: 'signing_public_key', type: 'text', nullable: true, comment: 'Llave pública asimétrica (Ed25519) del evento descargada por los escáneres de puerta para validación offline' })
  signingPublicKey: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'draft', comment: 'Estado del evento: draft, published, paused, cancelled' })
  status: string;

  @Column({ name: 'observation_reason', type: 'text', nullable: true, comment: 'Motivo o detalle de observación del evento registrado por la administración en el Backoffice' })
  observationReason: string | null;

  @Column({ name: 'ticketera_fee_snapshot', type: 'jsonb', nullable: true, comment: 'Snapshot inmutable de comisiones y tarifas pactadas por zona congeladas al momento de aprobar el evento (published)' })
  ticketeraFeeSnapshot: {
    approvedAt: string;
    approvedBy?: string;
    rulesVersion: string;
    feeRules: Record<string, any>;
    zones: Array<{
      zoneId: string;
      zoneName: string;
      regularPrice: number;
      serviceFee: number;
      feeIncluded: boolean;
      capacity: number;
    }>;
  } | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora de creación del registro' })
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

  @OneToMany(() => CouponEntity, (coupon) => coupon.event)
  coupons: CouponEntity[];

  @OneToMany(() => OrderEntity, (order) => order.event)
  orders: OrderEntity[];

  @OneToMany(() => EventAdvanceEntity, (advance) => advance.event)
  advances: EventAdvanceEntity[];

  @OneToOne(() => EventSettlementEntity, (settlement) => settlement.event)
  settlement: EventSettlementEntity;

  @OneToMany(() => UserFavoriteEventEntity, (fav) => fav.event)
  favorites: UserFavoriteEventEntity[];
}
