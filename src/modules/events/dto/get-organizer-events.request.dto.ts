import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class GetOrganizerEventsRequestDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado lógico: all, published, on_sale, sold_out, draft, completed, paused, cancelled',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional({
    description: 'Búsqueda libre por nombre del evento, recinto o código',
    example: 'Armonia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtro por rango temporal: 3m (últimos 3 meses), 6m (últimos 6 meses), 12m (último año), all (histórico)',
    example: '3m',
    default: '3m',
  })
  @IsOptional()
  @IsString()
  @IsIn(['3m', '6m', '12m', 'all'])
  period?: '3m' | '6m' | '12m' | 'all';
}

