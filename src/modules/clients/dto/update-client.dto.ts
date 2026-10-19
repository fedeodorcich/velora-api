import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ClientStatus } from '../entities/client.entity.js';

/**
 * Todos los campos son opcionales: se actualiza únicamente lo enviado.
 * Se define explícitamente para no depender de `@nestjs/mapped-types`.
 */
export class UpdateClientDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(160, { message: 'El nombre no puede superar los 160 caracteres.' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(255, { message: 'El correo no puede superar los 255 caracteres.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto.' })
  @MaxLength(50, { message: 'El teléfono no puede superar los 50 caracteres.' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'La empresa debe ser un texto.' })
  @MaxLength(160, { message: 'La empresa no puede superar los 160 caracteres.' })
  company?: string;

  @IsOptional()
  @IsString({ message: 'El CUIT/CUIL debe ser un texto.' })
  @MaxLength(20, { message: 'El CUIT/CUIL no puede superar los 20 caracteres.' })
  cuilCuit?: string;

  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'La moneda debe ser un código ISO 4217 de 3 letras (por ejemplo, USD).',
  })
  currency?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden superar los 2000 caracteres.' })
  notes?: string;

  @IsOptional()
  @IsEnum(ClientStatus, { message: 'El estado del cliente no es válido.' })
  status?: ClientStatus;
}
