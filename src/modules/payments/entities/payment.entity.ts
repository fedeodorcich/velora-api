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
import { Project } from '../../projects/entities/project.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum PaymentStatus {
  Pendiente = 'pendiente',
  Pagado = 'pagado',
}

/**
 * Cobro (cuota) de un proyecto. Se relaciona de forma unidireccional (sin lado
 * inverso) para evitar ciclos de imports ESM con `emitDecoratorMetadata`.
 */
@Entity('payments')
@Index('UQ_payments_user_number', ['userId', 'number'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_payments_user' })
  user: User;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'FK_payments_project' })
  project: Project;

  /** Correlativo por usuario (se muestra como `COB-0001`). */
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'varchar', length: 200 })
  concept: string;

  /** Monto del cobro (siempre mayor a 0). */
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  amount: number;

  /** Código ISO 4217 de 3 letras (derivado del proyecto). */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.Pendiente })
  status: PaymentStatus;

  /** Se completa al marcar el cobro como pagado; se limpia al volver a pendiente. */
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /** Medio de pago (texto libre corto: efectivo, transferencia, etc.). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  method: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
