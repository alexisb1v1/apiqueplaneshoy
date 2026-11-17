import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordRequestDto {
  @ApiProperty({
    example: 'ClaveActual123!',
    description: 'Contraseña actual de la cuenta',
  })
  @IsString({ message: 'La contraseña actual debe ser una cadena válida' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @MaxLength(100, { message: 'La contraseña actual excede el límite permitido' })
  oldPassword: string;

  @ApiProperty({
    example: 'NuevaClaveSegura2026!',
    description: 'Nueva contraseña (mínimo 6 caracteres)',
    minLength: 6,
  })
  @IsString({ message: 'La nueva contraseña debe ser una cadena válida' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  @MaxLength(100, { message: 'La nueva contraseña no puede exceder 100 caracteres' })
  newPassword: string;
}

