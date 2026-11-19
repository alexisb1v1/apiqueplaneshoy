import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminRejectSettlementRequestDto {
  @ApiProperty({
    description:
      'Motivo u observación formal del rechazo para que el promotor subsane',
    example:
      'El número de cuenta bancaria ingresado no coincide con el titular del RUC registrado.',
  })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de observación o rechazo es obligatorio' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  @MaxLength(500, { message: 'El motivo no debe exceder 500 caracteres' })
  reason: string;
}
