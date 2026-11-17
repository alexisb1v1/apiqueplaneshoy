import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export type LoginOrigin = 'web' | 'backoffice';

export class LoginUserRequestDto {
  @ApiProperty({
    description: 'Nombre de usuario registrado (o correo en usuarios web legacy)',
    example: 'abasilio',
  })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  username: string;

  @ApiProperty({
    description: 'Contraseña de la cuenta',
    example: 'Planes2026!',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;

  @ApiPropertyOptional({
    description: 'Origen de la solicitud de autenticación: web (portal cliente) o backoffice (consola administrativa)',
    example: 'web',
    enum: ['web', 'backoffice'],
    default: 'web',
  })
  @IsOptional()
  @IsIn(['web', 'backoffice'], { message: 'El origen debe ser web o backoffice' })
  origin?: LoginOrigin = 'web';
}
