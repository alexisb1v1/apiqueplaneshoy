import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
} from 'class-validator';
import { OrderItemDto } from './simulate-order-checkout.request.dto';

export class PrepareCulqiCheckoutRequestDto {
  @ApiProperty({ example: '7f5ecd03-ebe9-498b-b068-f3c041b02e51', description: 'ID o publicUuid del evento' })
  @IsNotEmpty({ message: 'El eventId es obligatorio' })
  @IsString({ message: 'El eventId debe ser una cadena de texto' })
  eventId!: string;

  @ApiProperty({ example: '1', description: 'ID o publicUuid de la función del evento' })
  @IsNotEmpty({ message: 'El showId es obligatorio' })
  @IsString({ message: 'El showId debe ser una cadena de texto' })
  showId!: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Entradas seleccionadas por zona' })
  @IsArray({ message: 'Los items deben ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes seleccionar al menos una entrada' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({
    example: 'yape',
    enum: ['card', 'yape', 'transfer', 'cuotealo'],
    description: 'Método preferido en la pasarela Multipago Culqi',
  })
  @IsNotEmpty({ message: 'El método de pago es obligatorio' })
  @IsIn(['card', 'yape', 'transfer', 'cuotealo'], {
    message: 'Método de pago no válido para Culqi',
  })
  paymentMethod!: 'card' | 'yape' | 'transfer' | 'cuotealo';

  @ApiProperty({ example: 'PROMOQPH', required: false })
  @IsOptional()
  @IsString({ message: 'El cupón debe ser una cadena de texto' })
  couponCode?: string;

  @ApiProperty({ example: '987654321', required: false })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  customerPhone?: string;
}

