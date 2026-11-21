import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
export class ContactRequestDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsIn(['consulta', 'problema', 'sugerencia', 'cuenta']) subject: string;
  @IsString() @MinLength(10) @MaxLength(5000) message: string;
  @Equals(true) privacyAccepted: boolean;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
export class DonationDto {
  @IsIn([500, 1000, 2500]) amount: number;
}
