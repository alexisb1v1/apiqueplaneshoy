import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { SocialIdentityEntity } from './social-identity.entity';
import { UserFavoriteEventEntity } from './user-favorite-event.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'integer', comment: 'Identificador único interno autoincremental del usuario' })
  id: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID para perfiles y APIs' })
  publicUuid: string;

  @Column({ type: 'varchar', length: 100, comment: 'Nombre completo o razón social del usuario' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150, unique: true, comment: 'Correo electrónico único utilizado para login y notificaciones' })
  email: string;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora en que el usuario confirmó su correo electrónico (null si está pendiente de verificación)' })
  emailVerifiedAt: Date | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, comment: 'Hash bcrypt de contraseña (nulo si se autentica por OAuth)' })
  passwordHash: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'customer', comment: 'Rol del usuario en la plataforma: customer, admin' })
  role: string;

  @Index()
  @Column({ name: 'is_organizer', type: 'boolean', default: false, comment: 'Indicador de si el usuario ha activado su perfil de organizador de eventos' })
  isOrganizer: boolean;

  @Column({ name: 'organizer_name', type: 'varchar', length: 150, nullable: true, comment: 'Nombre comercial de la productora o razón social del organizador' })
  organizerName: string | null;

  @Column({ name: 'organizer_document_type', type: 'varchar', length: 20, nullable: true, comment: 'Tipo de documento tributario o identidad del organizador: DNI, RUC, CE' })
  organizerDocumentType: string | null;

  @Column({ name: 'organizer_document_number', type: 'varchar', length: 20, nullable: true, comment: 'Número de documento de identidad o RUC' })
  organizerDocumentNumber: string | null;

  @Column({ name: 'organizer_phone', type: 'varchar', length: 30, nullable: true, comment: 'Teléfono o WhatsApp de contacto comercial del organizador' })
  organizerPhone: string | null;

  @Column({ name: 'organizer_logo_url', type: 'varchar', length: 512, nullable: true, comment: 'URL del logotipo o foto comercial de la productora' })
  organizerLogoUrl: string | null;

  @Column({ name: 'organizer_verified_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora en que la administración verificó la identidad KYC del promotor' })
  organizerVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora de registro del usuario en la plataforma' })
  createdAt: Date;

  // Relaciones
  @OneToMany(() => SocialIdentityEntity, (socialIdentity) => socialIdentity.user)
  socialIdentities: SocialIdentityEntity[];

  @OneToMany(() => EventEntity, (event) => event.organizer)
  events: EventEntity[];

  @OneToMany(() => OrderEntity, (order) => order.user)
  orders: OrderEntity[];

  @OneToMany(() => TicketEntity, (ticket) => ticket.user)
  tickets: TicketEntity[];

  @OneToMany(() => UserFavoriteEventEntity, (fav) => fav.user)
  favorites: UserFavoriteEventEntity[];
}
