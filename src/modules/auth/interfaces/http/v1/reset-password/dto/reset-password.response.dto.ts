import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ResetPasswordResponseDto {
  @ApiProperty({
    example: 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.',
    description: 'Mensaje de éxito tras actualizar la credencial',
  })
  @Expose()
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}

