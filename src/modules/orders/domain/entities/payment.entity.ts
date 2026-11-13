import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', comment: 'Identificador único interno autoincremental del pago' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()', comment: 'Identificador público UUID del comprobante de pago' })
  publicUuid: string;

  @Index()
  @Column({ name: 'order_id', type: 'bigint', comment: 'ID de la orden de compra que liquida este pago' })
  orderId: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, comment: 'Método o pasarela utilizada (credit_card, stripe, paypal, yape)' })
  paymentMethod: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: 'Monto monetario exacto procesado en esta transacción' })
  amount: number;

  @Column({
    name: 'gateway_fee_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
    comment: 'Comisión cobrada por la pasarela de pagos (Culqi) descontada de esta transacción',
  })
  gatewayFeeAmount: number;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'pending', comment: 'Estado del pago: pending, approved, rejected, refunded' })
  status: string;

  @Index()
  @Column({ name: 'external_transaction_id', type: 'varchar', length: 255, nullable: true, comment: 'ID de transacción de la pasarela externa de pago' })
  externalTransactionId: string | null;

  @Column({ name: 'gateway_response', type: 'jsonb', nullable: true, comment: 'Payload completo devuelto por la pasarela (Niubiz, Mercado Pago, Culqi, Stripe) para auditoría financiera' })
  gatewayResponse: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', comment: 'Fecha y hora en que se procesó el pago' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => OrderEntity, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}
