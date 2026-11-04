import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiPropertyOptional({
    example: '1.9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.f48e2...',
    description: 'Refresh token emitido durante el login o registro (opcional si viaja en cookie HttpOnly)',
  })
  @IsString({ message: 'El refreshToken debe ser una cadena de texto' })
  @IsOptional()
  readonly refreshToken?: string;
}

