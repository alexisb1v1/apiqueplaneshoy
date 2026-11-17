import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { SimulateOrderCheckoutResponseDto } from './simulate-order-checkout.response.dto';

@Exclude()
export class ConfirmCulqiChargeResponseDto {
  @Expose()
  @ApiProperty({ example: 'PAID', enum: ['PAID', 'REQUIRES_3DS'] })
  status!: 'PAID' | 'REQUIRES_3DS';

  @Expose()
  @ApiProperty({ example: false })
  requires3DS!: boolean;

  @Expose()
  @ApiProperty({ example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab' })
  orderPublicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'tkn_test_701ug3CDNJOAt5Q6' })
  tokenId!: string;

  @Expose()
  @Type(() => SimulateOrderCheckoutResponseDto)
  @ApiProperty({ type: SimulateOrderCheckoutResponseDto, nullable: true, required: false })
  checkoutResult!: SimulateOrderCheckoutResponseDto | null;
}

