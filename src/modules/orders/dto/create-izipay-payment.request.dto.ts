import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from './simulate-order-checkout.request.dto';

export class CreateIzipayPaymentRequestDto {
  @ApiProperty({ example: 'dd441542-8cd8-4bd9-8a59-2d912ac808e4' })
  @IsNotEmpty()
  @IsString()
  eventId!: string;

  @ApiProperty({ example: 'f1' })
  @IsNotEmpty()
  @IsString()
  showId!: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({ example: 'card', enum: ['card', 'yape'], required: false })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({ example: 'CYBER2026', required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
