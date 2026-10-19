import { IsEnum } from 'class-validator';
import { PaymentStatus } from '../entities/payment.entity.js';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus, { message: 'El estado del cobro no es válido.' })
  status: PaymentStatus;
}
