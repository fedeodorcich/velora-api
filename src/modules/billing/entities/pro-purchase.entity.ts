import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('billing_pro_purchases')
export class ProPurchase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  amount: number;
  @Column({ type: 'varchar', length: 3, default: 'ARS' }) currency: string;
  @Column({
    name: 'preference_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  preferenceId: string | null;
  @Column({ name: 'checkout_url', type: 'text', nullable: true, select: false })
  checkoutUrl: string | null;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @Column({ name: 'granted_until', type: 'timestamptz', nullable: true })
  grantedUntil: Date | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
