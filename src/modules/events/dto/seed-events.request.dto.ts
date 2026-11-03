import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SeedEventsRequestDto {
  @ApiPropertyOptional({
    description: 'Cantidad de eventos de prueba a generar (entre 1 y 100)',
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1 evento' })
  @Max(100, { message: 'La cantidad máxima permitida por ejecución es 100 eventos' })
  readonly count?: number = 10;
}
