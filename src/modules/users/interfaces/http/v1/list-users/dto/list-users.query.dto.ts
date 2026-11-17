import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Rol de los usuarios a consultar (customer, admin)',
    example: 'customer',
    default: 'customer',
  })
  @IsOptional()
  @IsString()
  @IsIn(['customer', 'admin'])
  role?: string = 'customer';

  @ApiPropertyOptional({
    description: 'Texto de búsqueda por nombre, email o username',
    example: 'valeria',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar solo organizadores o solo compradores',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  isOrganizer?: boolean;

  @ApiPropertyOptional({
    description: 'Número de página para paginación (base 1)',
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

