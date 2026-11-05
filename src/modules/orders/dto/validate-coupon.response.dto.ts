import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ValidateCouponResponseDto {
  @ApiProperty({ example: 'PROMOQPH', description: 'Código normalizado del cupón' })
  @Expose()
  code!: string;

  @ApiProperty({ example: 'percentage', enum: ['percentage', 'fixed'], description: 'Tipo de descuento aplicado' })
  @Expose()
  discountType!: 'percentage' | 'fixed';

  @ApiProperty({ example: 10.0, description: 'Valor del beneficio (porcentaje o soles)' })
  @Expose()
  discountValue!: number;

  @ApiProperty({ example: 24.0, description: 'Monto neto descontado en soles' })
  @Expose()
  discountAmount!: number;

  @ApiProperty({ example: 216.0, description: 'Nuevo total neto calculado' })
  @Expose()
  newTotal!: number;

  @ApiProperty({ example: 'Cupón aplicado con éxito (-10%)', description: 'Mensaje descriptivo' })
  @Expose()
  message!: string;
}

