import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'La contraseña actual es obligatoria.' })
  @MinLength(1, { message: 'La contraseña actual es obligatoria.' })
  currentPassword: string;

  @IsString({ message: 'La contraseña nueva es obligatoria.' })
  @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña nueva no puede superar los 72 caracteres.' })
  newPassword: string;
}
