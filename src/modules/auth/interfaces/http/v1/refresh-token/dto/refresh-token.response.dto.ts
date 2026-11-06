import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RefreshTokenResponseDto {
  @Expose()
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Nuevo Access Token JWT (Vigencia de 15 minutos)',
  })
  accessToken: string;

  @Expose()
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Alias de accessToken para compatibilidad',
  })
  token: string;

  @Expose()
  @ApiProperty({
    example: '1.9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.c82f9...',
    description: 'Nuevo Refresh Token rotado de 30 días en Redis',
  })
  refreshToken: string;

  @Expose()
  @ApiProperty({ example: 900, description: 'Segundos de vigencia del Access Token (15 minutos = 900s)' })
  expiresInSeconds: number;

  @Expose()
  @ApiProperty({ example: 'Token de acceso renovado exitosamente' })
  message: string;

  constructor(accessToken: string, refreshToken: string, expiresInSeconds = 900) {
    this.accessToken = accessToken;
    this.token = accessToken;
    this.refreshToken = refreshToken;
    this.expiresInSeconds = expiresInSeconds;
    this.message = 'Token de acceso renovado exitosamente';
  }
}

