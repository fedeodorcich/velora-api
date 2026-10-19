import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Todos los campos son opcionales: se actualiza únicamente lo enviado.
 * El proyecto y la moneda no se modifican (derivan del proyecto) y el estado se
 * cambia por separado con `PATCH /payments/:id/status`.
 */
export class UpdatePaymentDto {
  @IsOptional()
  @IsString({ message: 'El concepto debe ser un texto.' })
  @MinLength(2, { message: 'El concepto debe tener al menos 2 caracteres.' })
  @MaxLength(200, { message: 'El concepto no puede superar los 200 caracteres.' })
  concept?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número.' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0.' })
  amount?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vencimiento no es válida.' })
  dueDate?: string;

  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser un texto.' })
  @MaxLength(40, { message: 'El medio de pago no puede superar los 40 caracteres.' })
  method?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden superar los 2000 caracteres.' })
  notes?: string;
}
