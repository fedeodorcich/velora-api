import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../../../core/database/numeric.transformer.js';
import { Quote } from './quote.entity.js';

/** Línea de detalle de un presupuesto. Se elimina en cascada con su presupuesto. */
@Entity('quote_items')
export class QuoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_id', type: 'uuid' })
  quoteId: string;

  @ManyToOne(() => Quote, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quote_id', foreignKeyConstraintName: 'FK_quote_items_quote' })
  quote: Quote;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({ type: 'int', default: 0 })
  position: number;
}
