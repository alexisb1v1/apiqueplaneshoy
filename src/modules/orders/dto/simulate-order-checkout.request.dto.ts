import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ example: '1', description: 'ID de la zona elegida' })
  @IsNotEmpty({ message: 'El zoneId es obligatorio' })
  @IsString({ message: 'El zoneId debe ser un string' })
  zoneId!: string;

  @ApiProperty({ example: 2, description: 'Cantidad de entradas' })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1 entrada' })
  quantity!: number;
}

export class SimulateOrderCheckoutRequestDto {
  @ApiProperty({ example: '3', description: 'ID del evento' })
  @IsNotEmpty({ message: 'El eventId es obligatorio' })
  @IsString({ message: 'El eventId debe ser un string' })
  eventId!: string;

  @ApiProperty({ example: '1', description: 'ID de la función del evento' })
  @IsNotEmpty({ message: 'El showId es obligatorio' })
  @IsString({ message: 'El showId debe ser un string' })
  showId!: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Entradas seleccionadas' })
  @IsArray({ message: 'Los items deben ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debes seleccionar al menos una entrada' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({
    example: 'yape',
    enum: ['card', 'yape', 'transfer', 'apple_pay', 'google_pay'],
    description: 'Método de pago simulado',
  })
  @IsNotEmpty({ message: 'El método de pago es obligatorio' })
  @IsIn(['card', 'yape', 'transfer', 'apple_pay', 'google_pay'], {
    message: 'Método de pago no válido',
  })
  paymentMethod!: 'card' | 'yape' | 'transfer' | 'apple_pay' | 'google_pay';

  @ApiProperty({ example: 'cliente@queplaneshoy.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  customerEmail?: string;

  @ApiProperty({ example: 'Carlos Mendoza', required: false })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  customerName?: string;

  @ApiProperty({ example: '72819203', required: false })
  @IsOptional()
  @IsString({ message: 'El documento de identidad debe ser un texto' })
  customerDocument?: string;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Si es true, fuerza la simulación de rechazo bancario',
  })
  @IsOptional()
  @IsBoolean({ message: 'forceFailure debe ser booleano' })
  forceFailure?: boolean;
}

