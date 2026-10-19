import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Un proyecto se crea **siempre** a partir de un presupuesto aprobado (`aceptado`).
 * El cliente, el nombre, la moneda y el monto se derivan del presupuesto; el usuario
 * solo completa los datos de gestión (progreso, fechas, descripción y notas).
 */
export class CreateProjectDto {
  @IsUUID('4', { message: 'El presupuesto de origen no es válido.' })
  quoteId: string;

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
