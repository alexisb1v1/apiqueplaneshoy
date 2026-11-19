import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminPaySettlementRequestDto {
  @ApiProperty({
    description:
      'Número de operación o constancia bancaria de la transferencia',
    example: 'OP-84920194',
  })
  @IsString()
  @IsNotEmpty({
    message: 'El número de operación bancaria es obligatorio para liquidar',
  })
  @MaxLength(100, {
    message: 'El número de operación no debe exceder 100 caracteres',
  })
  transferReference: string;

  @ApiPropertyOptional({
    description: 'URL del comprobante o voucher bancario en PDF o imagen',
    example: 'https://cdn.queplanhoy.com/vouchers/liq-849201.pdf',
  })
  @IsString()
  @IsOptional()
  @MaxLength(512)
  transferVoucherUrl?: string;

  @ApiPropertyOptional({
    description:
      'Observaciones internas o notas de contabilidad para el comprobante',
    example: 'Transferencia realizada con éxito vía BCP Telecrédito Soles',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
