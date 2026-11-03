import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class IssuedTicketResponseDto {
  @Expose()
  @ApiProperty({ example: '101' })
  ticketId!: string;

  @Expose()
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  ticketUuid!: string;

  @Expose()
  @ApiProperty({ example: 1 })
  ticketNumber!: number;

  @Expose()
  @ApiProperty({ example: 'VIP' })
  zoneName!: string;

  @Expose()
  @ApiProperty({ example: 'Zona Preferencial VIP' })
  tierName!: string;

  @Expose()
  @ApiProperty({ example: 55.0 })
  unitPrice!: number;

  @Expose()
  @ApiProperty({ example: 'QPH|ORD:12|TCK:a1b2...|SHOW:1|ZONE:10' })
  qrPayload!: string;
}

@Exclude()
export class SimulateOrderCheckoutResponseDto {
  @Expose()
  @ApiProperty({ example: true })
  success!: boolean;

  @Expose()
  @ApiProperty({ example: '12' })
  orderId!: string;

  @Expose()
  @ApiProperty({ example: '#QPH-000012' })
  orderCode!: string;

  @Expose()
  @ApiProperty({ example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab' })
  orderPublicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'paid' })
  status!: string;

  @Expose()
  @ApiProperty({ example: 110.0 })
  subtotal!: number;

  @Expose()
  @ApiProperty({ example: 110.0 })
  totalAmount!: number;

  @Expose()
  @ApiProperty({ example: 'yape' })
  paymentMethod!: string;

  @Expose()
  @ApiProperty({ example: 'TX-849201' })
  txCode!: string;

  @Expose()
  @ApiProperty({ example: 'Pago procesado exitosamente por la pasarela simulada.' })
  message!: string;

  @Expose()
  @Type(() => IssuedTicketResponseDto)
  @ApiProperty({ type: [IssuedTicketResponseDto] })
  tickets!: IssuedTicketResponseDto[];
}

