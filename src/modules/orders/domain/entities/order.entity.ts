import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserEntity } from '@users/domain/entities/user.entity';
import { TicketEntity } from './ticket.entity';
import { PaymentEntity } from './payment.entity';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // Mapeado a string en TS para evitar overflow de bigint

  @Column({ type: 'uuid', name: 'public_uuid', default: () => 'gen_random_uuid()' })
  publicUuid: string;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ length: 50, default: 'pending' })
  status: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  totalAmount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Relaciones
  @ManyToOne(() => UserEntity, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => TicketEntity, (ticket) => ticket.order)
  tickets: TicketEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.order)
  payments: PaymentEntity[];
}
