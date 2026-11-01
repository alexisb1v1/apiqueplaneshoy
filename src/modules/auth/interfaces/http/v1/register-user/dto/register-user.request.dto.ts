import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterUserRequestDto {
  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Alexis Bermúdez',
  })
  @Transform(({ value, obj }) => (value ?? obj.fullName)?.trim())
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @ApiPropertyOptional({
    description: 'Alias alternativo de nombre completo para compatibilidad con el cliente',
    example: 'Alexis Bermúdez',
  })
  @IsOptional()
  @IsString({ message: 'El nombre completo debe ser una cadena de texto' })
  fullName?: string;

  @ApiProperty({
    description: 'Correo electrónico único para login y notificaciones',
    example: 'alexis@queplaneshoy.com',
  })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @MaxLength(150, { message: 'El correo electrónico no puede exceder 150 caracteres' })
  email: string;

  @ApiProperty({
    description: 'Contraseña de la cuenta (mínimo 6 caracteres)',
    example: 'Planes2026!',
    minLength: 6,
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(100, { message: 'La contraseña no puede exceder 100 caracteres' })
  password: string;

  @ApiPropertyOptional({
    description: 'Teléfono o celular de contacto',
    example: '+51 987654321',
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  phone?: string;
}
