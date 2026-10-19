import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Un cobro siempre cuelga de un proyecto del usuario. La moneda se deriva del
 * proyecto, por eso no se acepta aquí.
 */
export class CreatePaymentDto {
  @IsUUID('4', { message: 'El proyecto no es válido.' })
  projectId: string;

  @IsString({ message: 'El concepto debe ser un texto.' })
  @MinLength(2, { message: 'El concepto debe tener al menos 2 caracteres.' })
  @MaxLength(200, { message: 'El concepto no puede superar los 200 caracteres.' })
  concept: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número.' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0.' })
  amount: number;

  @IsDateString({}, { message: 'La fecha de vencimiento no es válida.' })
  dueDate: string;

  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser un texto.' })
  @MaxLength(40, { message: 'El medio de pago no puede superar los 40 caracteres.' })
  method?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden superar los 2000 caracteres.' })
  notes?: string;
}
