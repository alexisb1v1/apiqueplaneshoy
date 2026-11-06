import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class ValidateCouponRequestDto {
  @ApiProperty({ example: '3', description: 'ID, slug o publicUuid del evento' })
  @IsNotEmpty({ message: 'El eventId es obligatorio' })
  @IsString({ message: 'El eventId debe ser una cadena de texto' })
  eventId!: string;

  @ApiProperty({ example: 'PROMOQPH', description: 'Código del cupón a aplicar' })
  @IsNotEmpty({ message: 'El código del cupón es obligatorio' })
  @IsString({ message: 'El código del cupón debe ser una cadena de texto' })
  code!: string;

  @ApiProperty({ example: 120.0, description: 'Subtotal acumulado de las entradas en soles' })
  @IsNumber({}, { message: 'El subtotal debe ser un número' })
  @Min(0, { message: 'El subtotal no puede ser negativo' })
  subtotal!: number;
}

