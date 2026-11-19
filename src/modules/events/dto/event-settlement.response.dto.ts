import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

export class SettlementBreakdownZoneDto {
  @Expose()
  zoneId: string;

  @Expose()
  zoneName: string;

  @Expose()
  ticketsSold: number;

  @Expose()
  revenue: number;

  @Expose()
  serviceFee: number;
}

@Exclude()
export class EventSettlementResponseDto {
  @ApiProperty({ description: 'ID público UUID del corte de liquidación' })
  @Expose()
  publicUuid: string;

  @ApiProperty({ description: 'ID o UUID del evento asociado' })
  @Expose()
  eventId: string;

  @ApiPropertyOptional({ description: 'Nombre o título del evento' })
  @Expose()
  eventTitle?: string;

  @ApiPropertyOptional({ description: 'Código público del evento (ej: #EV-A1B2C3D4)' })
  @Expose()
  eventCode?: string;

  @ApiProperty({
    description: 'Estado de la liquidación (requested, in_review, approved, paid, rejected)',
    example: 'requested',
  })
  @Expose()
  status: string;

  @ApiProperty({
    description: 'Etiqueta legible del estado',
    example: 'En Revisión (24h - 72h)',
  })
  @Expose()
  statusLabel: string;

  @ApiProperty({
    description: 'Indica si ya existe una solicitud de liquidación formalmente enviada',
    example: true,
  })
  @Expose()
  isSettlementRequested: boolean;

  @ApiProperty({ description: 'Cantidad total de entradas confirmadas vendidas' })
  @Expose()
  totalTicketsSold: number;

  @ApiProperty({ description: 'Recaudación bruta nominal por venta de entradas' })
  @Expose()
  grossAmount: number;

  @ApiProperty({ description: 'Descuento total aplicado por cupones de descuento' })
  @Expose()
  totalCouponsDiscountAmount: number;

  @ApiProperty({ description: 'Comisión retenida por servicio de la ticketera' })
  @Expose()
  platformFeeAmount: number;

  @ApiProperty({ description: 'Comisiones de pasarelas de pago' })
  @Expose()
  gatewayFeeAmount: number;

  @ApiProperty({ description: 'Total de adelantos o transferencias previas descontadas' })
  @Expose()
  totalAdvancesAmount: number;

  @ApiProperty({ description: 'Ajustes o penalidades contractuales' })
  @Expose()
  adjustmentsAmount: number;

  @ApiProperty({
    description: 'Monto neto a transferir al organizador (gross - cupones - comisión)',
  })
  @Expose()
  netPayoutAmount: number;

  @ApiPropertyOptional({ description: 'Banco de destino' })
  @Expose()
  bankName: string | null;

  @ApiPropertyOptional({ description: 'Número de cuenta bancaria' })
  @Expose()
  bankAccountNumber: string | null;

  @ApiPropertyOptional({ description: 'Código de Cuenta Interbancario (CCI) de 20 dígitos' })
  @Expose()
  bankAccountCci: string | null;

  @ApiPropertyOptional({ description: 'Titular de la cuenta de abono' })
  @Expose()
  bankAccountHolder: string | null;

  @ApiPropertyOptional({ description: 'Tipo de cuenta (Ahorros / Corriente)' })
  @Expose()
  accountType?: string | null;

  @ApiPropertyOptional({ description: 'Tipo de documento (DNI / RUC)' })
  @Expose()
  documentType?: string | null;

  @ApiPropertyOptional({ description: 'Número de documento de identidad' })
  @Expose()
  documentNumber?: string | null;

  @ApiPropertyOptional({ description: 'Nro de operación bancaria de la transferencia definitiva' })
  @Expose()
  transferReference: string | null;

  @ApiPropertyOptional({ description: 'Comprobante o voucher bancario oficial de transferencia' })
  @Expose()
  transferVoucherUrl: string | null;

  @ApiPropertyOptional({ description: 'Fecha y hora en que se solicitó la liquidación' })
  @Expose()
  requestedAt: string | null;

  @ApiPropertyOptional({ description: 'Fecha y hora en que se completó el pago' })
  @Expose()
  paidAt: string | null;

  @ApiPropertyOptional({ description: 'Observaciones o notas de la solicitud' })
  @Expose()
  notes: string | null;

  @ApiPropertyOptional({
    description: 'Desglose por zonas',
    type: [SettlementBreakdownZoneDto],
  })
  @Expose()
  @Type(() => SettlementBreakdownZoneDto)
  breakdownByZone?: SettlementBreakdownZoneDto[] | null;
}
