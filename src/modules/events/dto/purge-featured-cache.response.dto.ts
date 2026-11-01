import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class PurgeFeaturedCacheResponseDto {
  @Expose()
  @ApiProperty({ example: true, description: 'Indica si la clave anterior fue purgada de Redis' })
  purged!: boolean;

  @Expose()
  @ApiProperty({ example: true, description: 'Indica si la caché fue recalculada y repoblada inmediatamente' })
  recreated!: boolean;

  @Expose()
  @ApiProperty({ example: 5, description: 'Cantidad de eventos destacados almacenados en la nueva caché' })
  count!: number;

  @Expose()
  @ApiProperty({ example: 'qph:home:hero', description: 'Nombre de la clave en Redis' })
  cacheKey!: string;

  @Expose()
  @ApiProperty({ example: 43200, description: 'Tiempo de vida de la clave en segundos (12 horas)' })
  ttlSeconds!: number;

  @Expose()
  @ApiProperty({
    example: 'Caché de eventos destacados invalidada y recreada exitosamente.',
    description: 'Mensaje descriptivo del resultado',
  })
  message!: string;
}

