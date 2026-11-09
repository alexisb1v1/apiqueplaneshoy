import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class VerifyResetTokenResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indica si el token es válido y no ha expirado',
  })
  @Expose()
  valid: boolean;

  @ApiProperty({
    example: 'u***@ejemplo.com',
    description: 'Correo electrónico parcialmente enmascarado por privacidad',
    required: false,
  })
  @Expose()
  maskedEmail?: string;

  constructor(valid: boolean, maskedEmail?: string) {
    this.valid = valid;
    this.maskedEmail = maskedEmail;
  }
}

