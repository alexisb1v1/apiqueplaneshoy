import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchEventsRequestDto {
  @ApiPropertyOptional({ description: 'Término de búsqueda libre', example: 'concierto rock' })
  @IsOptional()
  @IsString()
  readonly q?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría (CONCERTS, FESTIVALS, etc.)' })
  @IsOptional()
  @IsString()
  readonly category?: string;

  @ApiPropertyOptional({ description: 'Filtrar por código de ubigeo (ej: 150101)' })
  @IsOptional()
  @IsString()
  readonly ubigeoCode?: string;

  @ApiPropertyOptional({ description: 'Filtrar por nombre de ciudad o departamento (ej: Lima, Pucallpa)' })
  @IsOptional()
  @IsString()
  readonly city?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado del evento (published, draft, all)', default: 'published' })
  @IsOptional()
  @IsString()
  readonly status?: string;

  @ApiPropertyOptional({ description: 'Precio mínimo', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly minPrice?: number;

  @ApiPropertyOptional({ description: 'Precio máximo', example: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly maxPrice?: number;

  @ApiPropertyOptional({ description: 'Límite de resultados', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  readonly limit?: number;

  @ApiPropertyOptional({ description: 'Offset de paginación', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly offset?: number;
}

