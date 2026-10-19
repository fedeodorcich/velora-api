import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Todos los campos son opcionales: se actualiza únicamente lo enviado.
 * El vínculo con el presupuesto (`quoteId`), el cliente y el estado se gestionan
 * por separado (el cliente deriva del presupuesto de origen y el estado se cambia
 * con `PATCH /projects/:id/status`), por lo que no se incluyen aquí.
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(200, { message: 'El nombre no puede superar los 200 caracteres.' })
  name?: string;

  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'La moneda debe ser un código ISO 4217 de 3 letras (por ejemplo, USD).',
  })
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número.' })
  @Min(0, { message: 'El monto no puede ser negativo.' })
  budget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El progreso debe ser un número entero.' })
  @Min(0, { message: 'El progreso no puede ser menor a 0.' })
  @Max(100, { message: 'El progreso no puede superar el 100.' })
  progress?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio no es válida.' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de entrega no es válida.' })
  dueDate?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto.' })
  @MaxLength(2000, { message: 'La descripción no puede superar los 2000 caracteres.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden superar los 2000 caracteres.' })
  notes?: string;
}
