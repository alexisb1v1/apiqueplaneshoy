import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('organizer_bank_accounts')
export class OrganizerBankAccountEntity {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    comment: 'Identificador único interno autoincremental de la cuenta bancaria del promotor',
  })
  id: string;

  @Index({ unique: true })
  @Column({
    type: 'uuid',
    name: 'public_uuid',
    default: () => 'gen_random_uuid()',
    comment: 'Identificador público UUID de la cuenta bancaria',
  })
  publicUuid: string;

  @Index()
  @Column({
    name: 'user_id',
    type: 'integer',
    comment: 'ID del usuario organizador propietario de la cuenta bancaria',
  })
  userId: number;

  @Column({
    name: 'bank_name',
    type: 'varchar',
    length: 100,
    comment: 'Nombre del banco en Perú (ej: BCP, BBVA, Interbank, Scotiabank, BanBif)',
  })
  bankName: string;

  @Column({
    name: 'account_type',
    type: 'varchar',
    length: 30,
    default: 'checking',
    comment: 'Tipo de cuenta bancaria: savings (ahorros) o checking (corriente)',
  })
  accountType: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'PEN',
    comment: 'Moneda de la cuenta bancaria: PEN o USD',
  })
  currency: string;

  @Column({
    name: 'account_number',
    type: 'varchar',
    length: 50,
    comment: 'Número de cuenta bancaria local del organizador',
  })
  accountNumber: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Código de Cuenta Interbancario (CCI) de 20 dígitos en Perú',
  })
  cci: string | null;

  @Column({
    name: 'holder_name',
    type: 'varchar',
    length: 150,
    comment: 'Nombre completo o razón social del titular de la cuenta bancaria',
  })
  holderName: string;

  @Column({
    name: 'holder_document_type',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'Tipo de documento del titular: DNI, RUC o CE',
  })
  holderDocumentType: string | null;

  @Column({
    name: 'holder_document_number',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'Número de documento del titular de la cuenta',
  })
  holderDocumentNumber: string | null;

  @Index()
  @Column({
    name: 'is_default',
    type: 'boolean',
    default: false,
    comment: 'Indica si es la cuenta principal predeterminada para adelantos y liquidaciones',
  })
  isDefault: boolean;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'Indica si la cuenta bancaria se encuentra activa para abonos',
  })
  isActive: boolean;

  @Column({
    name: 'verified_at',
    type: 'timestamptz',
    nullable: true,
    comment: 'Fecha y hora en que administración/finanzas verificó la titularidad de la cuenta',
  })
  verifiedAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: 'Fecha y hora de registro de la cuenta bancaria',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: 'Fecha y hora de última actualización de la cuenta bancaria',
  })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.bankAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

