import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}

