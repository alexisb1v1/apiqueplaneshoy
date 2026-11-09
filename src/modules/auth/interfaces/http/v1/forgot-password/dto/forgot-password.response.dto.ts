import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: 'Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.',
    description: 'Mensaje de confirmación del envío de instrucciones',
  })
  @Expose()
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}

