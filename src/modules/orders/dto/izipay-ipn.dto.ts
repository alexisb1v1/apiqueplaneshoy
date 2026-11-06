import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class IzipayIpnDto {
  @ApiProperty({ description: 'Payload en formato JSON string devuelto por Izipay' })
  @IsNotEmpty()
  @IsString()
  'kr-answer'!: string;

  @ApiProperty({ description: 'Firma HMAC-SHA256 generada por Izipay' })
  @IsNotEmpty()
  @IsString()
  'kr-hash'!: string;

  @ApiProperty({ description: 'Algoritmo de hash (HMAC-SHA-256)', required: false })
  @IsOptional()
  @IsString()
  'kr-hash-algorithm'?: string;

  @ApiProperty({ description: 'Tipo de clave utilizada para el hash', required: false })
  @IsOptional()
  @IsString()
  'kr-hash-key'?: string;
}

