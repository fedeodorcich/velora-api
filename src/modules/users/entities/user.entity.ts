import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'pro_until', type: 'timestamptz', nullable: true, select: false })
  proUntil: Date | null;

  @Column({ name: 'quote_logo', type: 'text', nullable: true, select: false })
  quoteLogo: string | null;

  @Column({ name: 'pro_requested_at', type: 'timestamptz', nullable: true, select: false })
  proRequestedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
