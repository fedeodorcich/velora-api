import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuoteStatus } from '../entities/quote.entity.js';
import { QuoteItemDto } from './quote-item.dto.js';

/**
 * Todos los campos son opcionales: se actualiza únicamente lo enviado.
 * Si se envía `items`, se reemplaza el conjunto completo de líneas.
 */
export class UpdateQuoteDto {
  @IsOptional()
  @IsUUID('4', { message: 'El cliente indicado no es válido.' })
  clientId?: string;

  @IsOptional()
  @IsString({ message: 'El título debe ser un texto.' })
  @MinLength(2, { message: 'El título debe tener al menos 2 caracteres.' })
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  title?: string;

  @IsOptional()
  @IsEnum(QuoteStatus, { message: 'El estado del presupuesto no es válido.' })
  status?: QuoteStatus;

  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'La moneda debe ser un código ISO 4217 de 3 letras (por ejemplo, USD).',
  })
  currency?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de emisión no es válida.' })
  issueDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de validez no es válida.' })
  validUntil?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El impuesto debe ser un número.' })
  @Min(0, { message: 'El impuesto no puede ser negativo.' })
  @Max(100, { message: 'El impuesto no puede superar el 100%.' })
  taxRate?: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden superar los 2000 caracteres.' })
  notes?: string;

  @IsOptional()
  @IsArray({ message: 'Las líneas deben ser una lista.' })
  @ArrayMinSize(1, { message: 'Debes incluir al menos una línea.' })
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];
}
