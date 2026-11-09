import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @ApiProperty({
    example: 'a4f89b...',
    description: 'Token efímero de recuperación recibido por correo',
  })
  @IsNotEmpty({ message: 'El token de recuperación es obligatorio' })
  @IsString({ message: 'El token debe ser una cadena válida' })
  @Transform(({ value }: { value: string }) => value?.trim())
  token: string;

  @ApiProperty({
    example: 'NuevaClaveSegura2026!',
    description: 'Nueva contraseña que debe tener al menos 8 caracteres',
  })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser una cadena válida' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  newPassword: string;
}

