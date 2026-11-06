import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileRequestDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Alexis Bermúdez',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Primer nombre',
    example: 'Alexis',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Apellidos',
    example: 'Bermúdez',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'Los apellidos deben ser una cadena de texto' })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Teléfono o WhatsApp de contacto',
    example: '+51 987654321',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(30, { message: 'El teléfono no puede exceder 30 caracteres' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Nombre comercial de la productora o razón social del organizador',
    example: 'Selva Central Producciones SAC',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(150)
  organizerName?: string;

  @ApiPropertyOptional({
    description: 'Tipo de documento fiscal del organizador (RUC, DNI, CE)',
    example: 'RUC',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  organizerDocumentType?: string;

  @ApiPropertyOptional({
    description: 'Número de documento fiscal o RUC',
    example: '20601234567',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  organizerDocumentNumber?: string;

  @ApiPropertyOptional({
    description: 'URL del logo de la productora',
    example: 'https://cdn.queplaneshoy.com/organizers/logo.png',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  organizerLogoUrl?: string;
}

