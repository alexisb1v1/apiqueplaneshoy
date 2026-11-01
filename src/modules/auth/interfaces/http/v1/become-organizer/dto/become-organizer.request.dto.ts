import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, Length, IsOptional, IsUrl } from 'class-validator';

export class BecomeOrganizerRequestDto {
  @ApiProperty({
    example: 'Mega Producciones Perú',
    description: 'Nombre comercial de la productora o razón social del organizador',
  })
  @IsString({ message: 'El nombre comercial de la productora debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la productora u organizador es obligatorio' })
  @Length(2, 150, { message: 'El nombre de la productora debe tener entre 2 y 150 caracteres' })
  readonly organizerName: string;

  @ApiProperty({
    example: 'RUC',
    enum: ['DNI', 'RUC', 'CE'],
    description: 'Tipo de documento tributario o de identidad del organizador',
  })
  @IsString({ message: 'El tipo de documento debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio' })
  @IsEnum(['DNI', 'RUC', 'CE'], { message: 'El tipo de documento debe ser DNI, RUC o CE' })
  readonly organizerDocumentType: string;

  @ApiProperty({
    example: '20601234567',
    description: 'Número de documento de identidad o RUC (8 dígitos para DNI, 11 para RUC)',
  })
  @IsString({ message: 'El número de documento debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @Length(8, 20, { message: 'El número de documento debe tener entre 8 y 20 caracteres' })
  readonly organizerDocumentNumber: string;

  @ApiProperty({
    example: '+51 987654321',
    description: 'Teléfono o WhatsApp de contacto comercial del organizador',
  })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El teléfono de contacto comercial es obligatorio' })
  @Length(8, 30, { message: 'El teléfono debe tener entre 8 y 30 caracteres' })
  readonly organizerPhone: string;

  @ApiProperty({
    example: 'https://cdn.queplaneshoy.com/logos/organizador.png',
    description: 'URL del logotipo o foto de la productora (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El logo debe ser una cadena de texto' })
  readonly organizerLogoUrl?: string;
}

