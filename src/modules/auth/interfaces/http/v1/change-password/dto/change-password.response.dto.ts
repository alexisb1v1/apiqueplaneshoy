import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ChangePasswordResponseDto {
  @ApiProperty({
    example: 'Tu contraseña ha sido actualizada exitosamente.',
    description: 'Mensaje de confirmación del cambio de contraseña',
  })
  @Expose()
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}

