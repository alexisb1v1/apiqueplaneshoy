import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class SeededEventSummaryDto {
  @Expose()
  @ApiProperty({ example: '101' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Grupo 5 en Vivo - Noche de Oro' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'grupo-5-en-vivo-noche-de-oro-a8bc3' })
  slug: string;

  @Expose()
  @ApiProperty({ example: 'CONCERTS' })
  category: string;

  @Expose()
  @ApiProperty({ example: 'Pucallpa' })
  city: string;

  @Expose()
  @ApiProperty({ example: 'published' })
  status: string;

  @Expose()
  @ApiProperty({ example: true })
  isFeatured: boolean;

  @Expose()
  @ApiProperty({ example: false })
  hasLandingPage: boolean;

  @Expose()
  @ApiProperty({ example: '2026-11-04T01:00:00.000Z' })
  firstShowTime: string;

  @Expose()
  @ApiProperty({ example: false, description: 'True si las funciones del evento ya concluyeron (para pruebas del cron)' })
  isPast: boolean;

  @Expose()
  @ApiProperty({ example: 2 })
  showsCount: number;

  @Expose()
  @ApiProperty({ example: 3 })
  zonesCount: number;
}

@Exclude()
export class SeedEventsResponseDto {
  @Expose()
  @ApiProperty({ example: 15 })
  requestedCount: number;

  @Expose()
  @ApiProperty({ example: 15 })
  createdCount: number;

  @Expose()
  @ApiProperty({ example: 4, description: 'Cantidad de eventos con funciones en el pasado (ideales para validar el Cron)' })
  pastEventsCount: number;

  @Expose()
  @ApiProperty({ example: 11, description: 'Cantidad de eventos vigentes en cartelera' })
  upcomingEventsCount: number;

  @Expose()
  @ApiProperty({ example: 'Carga masiva de eventos completada con éxito. Los índices de MeiliSearch y caché de Redis fueron sincronizados.' })
  message: string;

  @Expose()
  @Type(() => SeededEventSummaryDto)
  @ApiProperty({ type: [SeededEventSummaryDto] })
  events: SeededEventSummaryDto[];
}
