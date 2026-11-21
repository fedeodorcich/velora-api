import { IsOptional, IsString, Matches } from 'class-validator';
export class RefreshProPurchaseDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,32}$/)
  paymentId?: string;
}
