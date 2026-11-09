import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../core/dto/pagination-query.dto.js';

export type PaymentListStatus = 'pendiente' | 'pagado' | 'vencido';

export class PaymentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pendiente', 'pagado', 'vencido'])
  status?: PaymentListStatus;
}
