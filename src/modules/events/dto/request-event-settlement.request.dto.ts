import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RequestEventSettlementRequestDto {
  @ApiProperty({
    description:
      'Entidad bancaria en Perú (ej. BCP, BBVA, Interbank, Scotiabank, BanBif, Banco de la Nación)',
    example: 'BCP',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es obligatorio' })
  @MaxLength(100, {
    message: 'El nombre del banco no debe exceder 100 caracteres',
  })
  bankName: string;

  @ApiPropertyOptional({
    description: 'Tipo de cuenta bancaria (Ahorros Soles, Corriente Soles)',
    example: 'Ahorros Soles',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'El tipo de cuenta no debe exceder 50 caracteres' })
  accountType?: string;

  @ApiProperty({
    description: 'Titular de la cuenta bancaria o Razón Social',
    example: 'Juan Perez Eventos SAC',
  })
  @IsString()
  @IsNotEmpty({ message: 'El titular de la cuenta es obligatorio' })
  @MinLength(3, {
    message: 'El titular de la cuenta debe tener al menos 3 caracteres',
  })
  @MaxLength(150, {
    message: 'El titular de la cuenta no debe exceder 150 caracteres',
  })
  accountHolder: string;

  @ApiPropertyOptional({
    description: 'Tipo de documento del titular (DNI, RUC, CE)',
    example: 'RUC',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  documentType?: string;

  @ApiPropertyOptional({
    description:
      'Número de documento de identidad del titular (DNI de 8 dígitos o RUC de 11 dígitos)',
    example: '20601234567',
  })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  documentNumber?: string;

  @ApiProperty({
    description: 'Número de cuenta bancaria',
    example: '193-98765432-0-12',
  })
  @IsString()
  @IsNotEmpty({ message: 'El número de cuenta bancaria es obligatorio' })
  @MinLength(6, {
    message: 'El número de cuenta debe tener al menos 6 caracteres',
  })
  @MaxLength(50, {
    message: 'El número de cuenta no debe exceder 50 caracteres',
  })
  accountNumber: string;

  @ApiPropertyOptional({
    description:
      'Código de Cuenta Interbancario (CCI) de exactamente 20 dígitos (Obligatorio para otros bancos, opcional para BCP)',
    example: '00219300987654320112',
  })
  @ValidateIf(
    (o: RequestEventSettlementRequestDto) =>
      o.bankName !== 'BCP' ||
      Boolean(o.accountCci && o.accountCci.trim().length > 0),
  )
  @IsString()
  @IsNotEmpty({
    message:
      'El código CCI interbancario es obligatorio para transferencias a otros bancos',
  })
  @Length(20, 20, {
    message: 'El CCI debe tener exactamente 20 dígitos numéricos',
  })
  @Matches(/^\d{20}$/, {
    message: 'El CCI debe contener únicamente 20 dígitos numéricos',
  })
  accountCci?: string;

  @ApiPropertyOptional({
    description:
      'Notas adicionales u observaciones del organizador para la liquidación',
    example: 'Por favor emitir comprobante a nombre de Juan Perez Eventos SAC',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Las notas no deben exceder 500 caracteres' })
  notes?: string;
}
