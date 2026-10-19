import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'El nombre es obligatorio.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar los 120 caracteres.' })
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(255, { message: 'El correo no puede superar los 255 caracteres.' })
  email: string;

  @IsString({ message: 'La contraseña es obligatoria.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña no puede superar los 72 caracteres.' })
  password: string;
}
