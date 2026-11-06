import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { EventEntity } from './event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';

@Entity('event_advances')
export class EventAdvanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental del adelanto' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID del adelanto para recibo/voucher' })
  publicUuid: string;

  @Index()
  @Column({ name: 'event_id', type: 'bigint', comment: 'ID del evento al que pertenece este adelanto a cuenta' })
  eventId: string;

  @Index()
  @Column({ name: 'organizer_id', type: 'integer', comment: 'ID del usuario organizador que solicita el adelanto' })
  organizerId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, comment: 'Monto monetario del adelanto solicitado a cuenta' })
  amount: number;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'requested', comment: 'Estado del adelanto: requested, in_review, approved, paid, rejected' })
  status: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true, comment: 'Nombre de la entidad bancaria de destino (ej: BCP, BBVA, Interbank)' })
  bankName: string | null;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 50, nullable: true, comment: 'Número de cuenta bancaria del organizador' })
  bankAccountNumber: string | null;

  @Column({ name: 'bank_account_cci', type: 'varchar', length: 50, nullable: true, comment: 'Código de Cuenta Interbancario (CCI) de 20 dígitos' })
  bankAccountCci: string | null;

  @Column({ name: 'bank_account_holder', type: 'varchar', length: 150, nullable: true, comment: 'Nombre o razón social del titular de la cuenta bancaria' })
  bankAccountHolder: string | null;

  @Column({ name: 'transfer_reference', type: 'varchar', length: 100, nullable: true, comment: 'Número o código de operación bancaria de la transferencia del adelanto' })
  transferReference: string | null;

  @Column({ name: 'transfer_voucher_url', type: 'varchar', length: 512, nullable: true, comment: 'URL del comprobante o voucher bancario de la transferencia' })
  transferVoucherUrl: string | null;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz', comment: 'Fecha y hora en que el organizador solicitó el adelanto' })
  requestedAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora en que la administración realizó la transferencia del adelanto' })
  paidAt: Date | null;

  @Column({ name: 'processed_by_user_id', type: 'integer', nullable: true, comment: 'ID del usuario administrador que procesó y autorizó el desembolso' })
  processedByUserId: number | null;

  @Column({ type: 'text', nullable: true, comment: 'Notas, motivo de solicitud o razones de rechazo administrativo' })
  notes: string | null;

  // Relaciones
  @ManyToOne(() => EventEntity, (event) => event.advances, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: UserEntity;
}
