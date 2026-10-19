import { Type } from 'class-transformer';
import { IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class QuoteItemDto {
  @IsString({ message: 'La descripción de la línea es obligatoria.' })
  @MinLength(1, { message: 'La descripción de la línea no puede estar vacía.' })
  @MaxLength(200, { message: 'La descripción no puede superar los 200 caracteres.' })
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'La cantidad debe ser un número.' })
  @Min(0.01, { message: 'La cantidad debe ser mayor que cero.' })
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio unitario debe ser un número.' })
  @Min(0, { message: 'El precio unitario no puede ser negativo.' })
  unitPrice: number;
}
