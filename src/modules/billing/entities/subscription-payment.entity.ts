import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('billing_subscription_payments')
export class SubscriptionPayment {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_subscription_payments_user' })
  user: User;

  @Column({ name: 'subscription_id', type: 'varchar', length: 64 })
  subscriptionId: string;

  @Column({ type: 'varchar', length: 32 })
  status: string;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;
}
