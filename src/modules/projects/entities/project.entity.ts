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
import { Quote } from '../../quotes/entities/quote.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum ProjectStatus {
  Planificado = 'planificado',
  EnProgreso = 'en_progreso',
  Pausado = 'pausado',
  Finalizado = 'finalizado',
  Cancelado = 'cancelado',
}

/**
 * Proyecto (trabajo adjudicado) de un usuario para un cliente.
 * Se relaciona de forma unidireccional (sin lado inverso) para evitar ciclos de
 * imports ESM con `emitDecoratorMetadata`.
 */
@Entity('projects')
@Index('UQ_projects_user_number', ['userId', 'number'], { unique: true })
@Index('UQ_projects_quote', ['quoteId'], { unique: true })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_projects_user' })
  user: User;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id', foreignKeyConstraintName: 'FK_projects_client' })
  client: Client;

  /** Presupuesto de origen (opcional). Único: un proyecto por presupuesto. */
  @Column({ name: 'quote_id', type: 'uuid', nullable: true })
  quoteId: string | null;

  @ManyToOne(() => Quote, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'quote_id', foreignKeyConstraintName: 'FK_projects_quote' })
  quote: Quote | null;

  /** Correlativo por usuario (se muestra como `PRY-0001`). */
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.Planificado })
  status: ProjectStatus;

  /** Código ISO 4217 de 3 letras. */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  /** Monto acordado (base para los cobros). */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  budget: number;

  /** Progreso manual, de 0 a 100. */
  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
