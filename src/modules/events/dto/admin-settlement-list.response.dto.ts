import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AdminSettlementItemDto {
  @ApiProperty({ example: '1' })
  @Expose()
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  publicUuid: string;

  @ApiProperty({ example: '#LIQ-A1B2C3D4' })
  @Expose()
  code: string;

  @ApiProperty({ example: '15' })
  @Expose()
  eventId: string;

  @ApiProperty({ example: 'Gran Concierto de Rock 2026' })
  @Expose()
  eventTitle: string;

  @ApiProperty({ example: '#EV-B3F54562' })
  @Expose()
  eventCode: string;

  @ApiProperty({ example: 'completed' })
  @Expose()
  eventStatus: string;

  @ApiProperty({ example: 42 })
  @Expose()
  organizerId: number;

  @ApiProperty({ example: 'Productora Selva Viva SAC' })
  @Expose()
  organizerName: string;

  @ApiProperty({ example: 'RUC' })
  @Expose()
  organizerDocumentType: string;

  @ApiProperty({ example: '20601234567' })
  @Expose()
  organizerDocumentNumber: string;

  @ApiProperty({ example: 'BCP' })
  @Expose()
  bankName: string;

  @ApiProperty({ example: '193-98765432-0-12' })
  @Expose()
  bankAccountNumber: string;

  @ApiPropertyOptional({ example: '00219300987654320112' })
  @Expose()
  bankAccountCci: string | null;

  @ApiProperty({ example: 'Productora Selva Viva SAC' })
  @Expose()
  bankAccountHolder: string;

  @ApiPropertyOptional({ example: 'Ahorros Soles' })
  @Expose()
  accountType: string | null;

  @ApiProperty({ example: 450 })
  @Expose()
  totalTicketsSold: number;

  @ApiProperty({ example: 45000.0 })
  @Expose()
  grossAmount: number;

  @ApiProperty({ example: 1200.0 })
  @Expose()
  totalCouponsDiscountAmount: number;

  @ApiProperty({ example: 3150.0 })
  @Expose()
  platformFeeAmount: number;

  @ApiProperty({ example: 40650.0 })
  @Expose()
  netPayoutAmount: number;

  @ApiProperty({ example: 'requested' })
  @Expose()
  status: string;

  @ApiProperty({ example: 'En Revisión (24h - 72h)' })
  @Expose()
  statusLabel: string;

  @ApiProperty({ example: '2026-11-18T20:00:00.000Z' })
  @Expose()
  requestedAt: string;

  @ApiPropertyOptional({ example: '2026-11-19T15:30:00.000Z' })
  @Expose()
  paidAt: string | null;

  @ApiPropertyOptional({ example: 'OP-9842104' })
  @Expose()
  transferReference: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.queplanhoy.com/vouchers/v-123.pdf' })
  @Expose()
  transferVoucherUrl: string | null;

  @ApiPropertyOptional({ example: 'Notas del promotor' })
  @Expose()
  notes: string | null;

  @ApiProperty({ example: 14.5, description: 'Horas transcurridas desde la solicitud' })
  @Expose()
  hoursElapsed: number;
}

@Exclude()
export class AdminSettlementListResponseDto {
  @ApiProperty({ type: [AdminSettlementItemDto] })
  @Expose()
  items: AdminSettlementItemDto[];

  @ApiProperty({ example: 1 })
  @Expose()
  total: number;
}
