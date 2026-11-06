import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationResponseDto {
  @ApiProperty({
    example: 'Correo de verificación reenviado exitosamente. Revisa tu bandeja de entrada.',
  })
  message: string;

  constructor(
    message = 'Correo de verificación reenviado exitosamente. Revisa tu bandeja de entrada.',
  ) {
    this.message = message;
  }
}
