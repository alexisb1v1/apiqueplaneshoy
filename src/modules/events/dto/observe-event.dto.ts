import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ObserveEventDto {
  @ApiPropertyOptional({
    description: 'Motivo o detalle de observación del evento para el promotor',
    example: 'Falta adjuntar contrato de recinto o resolución municipal',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

