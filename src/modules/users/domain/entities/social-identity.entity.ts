import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('social_identities')
@Index(['provider', 'providerId'], { unique: true })
export class SocialIdentityEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno de la identidad social' })
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'integer', comment: 'ID del usuario propietario de esta cuenta social' })
  userId: number;

  @Column({ length: 50, comment: 'Nombre del proveedor de identidad (google, facebook, apple)' })
  provider: string;

  @Column({ name: 'provider_id', length: 255, comment: 'ID único entregado por el proveedor externo para este usuario' })
  providerId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora en que se vinculó la cuenta externa' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => UserEntity, (user) => user.socialIdentities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
