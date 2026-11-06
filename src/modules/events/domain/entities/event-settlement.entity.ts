import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, ManyToOne, JoinColumn, Index } from 'typeorm';
import { EventEntity } from './event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';

@Entity('event_settlements')
export class EventSettlementEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental de la liquidación final' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID de la liquidación para descarga de estado de cuenta' })
  publicUuid: string;

  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'bigint', comment: 'ID del evento liquidado (Relación 1 a 1 estricta: un evento solo se liquida una vez)' })
  eventId: string;

  @Index()
  @Column({ name: 'organizer_id', type: 'integer', comment: 'ID del usuario organizador titular que recibe la liquidación' })
  organizerId: number;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'requested', comment: 'Estado de la liquidación: requested, in_review, approved, paid, rejected' })
  status: string;

  @Column({ name: 'total_tickets_sold', type: 'integer', comment: 'Cantidad total de boletos efectivamente vendidos en el evento' })
  totalTicketsSold: number;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 12, scale: 2, comment: 'Recaudación monetaria bruta total por venta de boletos' })
  grossAmount: number;

  @Column({ name: 'total_coupons_discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0.00, comment: 'Total de descuentos por cupones de descuento canjeados en el evento asumidos por el organizador' })
  totalCouponsDiscountAmount: number;

  @Column({ name: 'platform_fee_amount', type: 'decimal', precision: 12, scale: 2, comment: 'Total retenido por comisión de servicio de la ticketera Qué Planes Hoy' })
  platformFeeAmount: number;

  @Column({ name: 'gateway_fee_amount', type: 'decimal', precision: 12, scale: 2, comment: 'Total retenido por comisiones de procesamiento de pasarelas de pago' })
  gatewayFeeAmount: number;

  @Column({ name: 'total_advances_amount', type: 'decimal', precision: 12, scale: 2, default: 0.00, comment: 'Total de adelantos a cuenta previamente transferidos que se descuentan de la liquidación' })
  totalAdvancesAmount: number;

  @Column({ name: 'adjustments_amount', type: 'decimal', precision: 12, scale: 2, default: 0.00, comment: 'Ajustes, devoluciones por reclamos, contracargos o penalidades contractuales' })
  adjustmentsAmount: number;

  @Column({ name: 'net_payout_amount', type: 'decimal', precision: 12, scale: 2, comment: 'Monto neto definitivo a pagar/transferir al organizador (gross - fees - adelantos - ajustes)' })
  netPayoutAmount: number;

  @Column({ name: 'breakdown_by_zone', type: 'jsonb', comment: 'Reporte congelado e inmutable con detalle de boletos vendidos por zona, precios y lista de adelantos descontados' })
  breakdownByZone: Record<string, any>;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true, comment: 'Entidad bancaria del organizador (BCP, BBVA, etc.)' })
  bankName: string | null;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 50, nullable: true, comment: 'Número de cuenta bancaria' })
  bankAccountNumber: string | null;

  @Column({ name: 'bank_account_cci', type: 'varchar', length: 50, nullable: true, comment: 'Código de Cuenta Interbancario (CCI) de 20 dígitos' })
  bankAccountCci: string | null;

  @Column({ name: 'bank_account_holder', type: 'varchar', length: 150, nullable: true, comment: 'Titular o Razón Social de la cuenta bancaria' })
  bankAccountHolder: string | null;

  @Column({ name: 'transfer_reference', type: 'varchar', length: 100, nullable: true, comment: 'Número de operación bancaria de la transferencia final del saldo' })
  transferReference: string | null;

  @Column({ name: 'transfer_voucher_url', type: 'varchar', length: 512, nullable: true, comment: 'URL del voucher o constancia bancaria de la liquidación final' })
  transferVoucherUrl: string | null;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz', comment: 'Fecha y hora en que el organizador solicitó el corte de liquidación' })
  requestedAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true, comment: 'Fecha y hora en que la ticketera transfirió el saldo definitivo al promotor' })
  paidAt: Date | null;

  @Column({ name: 'processed_by_user_id', type: 'integer', nullable: true, comment: 'ID del administrador que auditó y autorizó el pago' })
  processedByUserId: number | null;

  @Column({ type: 'text', nullable: true, comment: 'Observaciones de auditoría o justificación en caso de rechazo' })
  notes: string | null;

  // Relaciones
  @OneToOne(() => EventEntity, (event) => event.settlement, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event: EventEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: UserEntity;
}
