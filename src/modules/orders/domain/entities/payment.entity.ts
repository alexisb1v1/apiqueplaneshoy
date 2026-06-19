import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // Mapeado a string en TS para evitar overflow de bigint

  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()' })
  publicUuid: string;

  @Column({ name: 'order_id', type: 'bigint' })
  orderId: string;

  @Column({ name: 'payment_method', length: 50 })
  paymentMethod: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 50, default: 'pending' })
  status: string;

  @Column({ name: 'external_transaction_id', type: 'varchar', length: 255, nullable: true })
  externalTransactionId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relaciones
  @ManyToOne(() => OrderEntity, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}
