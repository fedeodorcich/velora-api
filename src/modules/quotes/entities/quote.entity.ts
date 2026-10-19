import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../../core/database/numeric.transformer.js';
import { Client } from '../../clients/entities/client.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum QuoteStatus {
  Borrador = 'borrador',
  Enviado = 'enviado',
  Aceptado = 'aceptado',
  Rechazado = 'rechazado',
}

/**
 * Presupuesto de un usuario para un cliente.
 * Las líneas de detalle viven en `QuoteItem` (relación unidireccional: no se declara
 * `Quote.items` para evitar un ciclo de imports ESM con `emitDecoratorMetadata`).
 */
@Entity('quotes')
@Index('UQ_quotes_user_number', ['userId', 'number'], { unique: true })
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_quotes_user' })
  user: User;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id', foreignKeyConstraintName: 'FK_quotes_client' })
  client: Client;

  /** Correlativo por usuario (se muestra como `P-0001`). */
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'enum', enum: QuoteStatus, default: QuoteStatus.Borrador })
  status: QuoteStatus;

  /** Código ISO 4217 de 3 letras. */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string | null;

  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  taxRate: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  subtotal: number;

  @Column({
    name: 'tax_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  taxAmount: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  total: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
