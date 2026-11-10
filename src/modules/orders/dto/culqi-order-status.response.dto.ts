import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { SimulateOrderCheckoutResponseDto } from './simulate-order-checkout.response.dto';

@Exclude()
export class CulqiOrderStatusResponseDto {
  @Expose()
  @ApiProperty({ example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab' })
  orderPublicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'pending', enum: ['pending', 'paid', 'expired', 'cancelled'] })
  status!: 'pending' | 'paid' | 'expired' | 'cancelled' | string;

  @Expose()
  @ApiProperty({ example: 'pending', nullable: true, required: false })
  culqiState?: string | null;

  @Expose()
  @ApiProperty({ example: '987654321', nullable: true, required: false })
  paymentCode?: string | null;

  @Expose()
  @ApiProperty({ example: '2026-11-10T23:30:00.000Z', nullable: true, required: false })
  expiresAt?: string | null;

  @Expose()
  @Type(() => SimulateOrderCheckoutResponseDto)
  @ApiProperty({ type: SimulateOrderCheckoutResponseDto, nullable: true, required: false })
  checkoutResult?: SimulateOrderCheckoutResponseDto | null;
}

