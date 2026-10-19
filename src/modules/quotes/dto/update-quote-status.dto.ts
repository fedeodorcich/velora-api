import { IsEnum } from 'class-validator';
import { QuoteStatus } from '../entities/quote.entity.js';

export class UpdateQuoteStatusDto {
  @IsEnum(QuoteStatus, { message: 'El estado del presupuesto no es válido.' })
  status: QuoteStatus;
}
