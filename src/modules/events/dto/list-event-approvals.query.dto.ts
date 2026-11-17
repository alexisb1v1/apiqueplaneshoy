import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListEventApprovalsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtro por estado de aprobación: pending, in_review, published, observed, all',
    example: 'in_review',
    default: 'in_review',
  })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'in_review', 'published', 'observed', 'all'])
  status?: string = 'in_review';

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre del evento, recinto o nombre de organizador',
    example: 'Cumbia',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Número de página (base 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de elementos por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

