import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../core/dto/pagination-query.dto.js';
import { QuoteStatus } from '../entities/quote.entity.js';

export class QuoteListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}
