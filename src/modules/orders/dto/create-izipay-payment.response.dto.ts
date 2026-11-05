import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CreateIzipayPaymentResponseDto {
  @Expose()
  @ApiProperty({ example: true })
  success!: boolean;

  @Expose()
  @ApiProperty({ example: 'DEMO-TOKEN-xxxx' })
  formToken!: string;

  @Expose()
  @ApiProperty({ example: '12345678:testpublickey_xxx' })
  publicKey!: string;

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
  @ApiProperty({ example: 120.0 })
  totalAmount!: number;

  @Expose()
  @ApiProperty({ example: 20.0 })
  discountAmount!: number;

  @Expose()
  @ApiProperty({ example: 'CYBER2026', nullable: true })
  couponCode!: string | null;

  @Expose()
  @ApiProperty({ example: 'https://api.micuentaweb.pe' })
  clientEndpoint!: string;
}

