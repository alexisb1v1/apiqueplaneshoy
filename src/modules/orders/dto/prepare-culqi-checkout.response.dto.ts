import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class CulqiCustomerPreviewDto {
  @Expose()
  @ApiProperty({ example: 'Carlos' })
  firstName!: string;

  @Expose()
  @ApiProperty({ example: 'Mendoza' })
  lastName!: string;

  @Expose()
  @ApiProperty({ example: 'carlos@queplaneshoy.com' })
  email!: string;

  @Expose()
  @ApiProperty({ example: '+51987654321' })
  phone!: string;
}

@Exclude()
export class PrepareCulqiCheckoutResponseDto {
  @Expose()
  @ApiProperty({ example: '45' })
  orderId!: string;

  @Expose()
  @ApiProperty({ example: '#QPH-000045' })
  orderCode!: string;

  @Expose()
  @ApiProperty({ example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab' })
  orderPublicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'ord_test_abc123xyz' })
  culqiOrderId!: string;

  @Expose()
  @ApiProperty({ example: 12000, description: 'Monto total calculado en céntimos' })
  amountInCents!: number;

  @Expose()
  @ApiProperty({ example: 120.0 })
  totalAmount!: number;

  @Expose()
  @ApiProperty({ example: 'PEN' })
  currency!: 'PEN';

  @Expose()
  @ApiProperty({ example: 'queplaneshoy • Entradas' })
  title!: string;

  @Expose()
  @ApiProperty({ example: '2 entradas para Bareto en Concierto' })
  description!: string;

  @Expose()
  @ApiProperty({ example: '2026-11-10T23:30:00.000Z' })
  expiresAt!: string;

  @Expose()
  @ApiProperty({ example: 'pk_test_xxxxxxxxxxxx' })
  publicKey!: string;

  @Expose()
  @ApiProperty({ example: 'https://js.culqi.com/checkout-js' })
  checkoutScriptUrl!: string;

  @Expose()
  @ApiProperty({ example: 'https://3ds.culqi.com' })
  threeDsScriptUrl!: string;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  rsaId!: string | null;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  rsaPublicKey!: string | null;

  @Expose()
  @Type(() => CulqiCustomerPreviewDto)
  @ApiProperty({ type: CulqiCustomerPreviewDto })
  customer!: CulqiCustomerPreviewDto;
}

