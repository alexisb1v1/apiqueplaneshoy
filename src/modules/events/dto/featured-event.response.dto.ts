import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class FeaturedEventResponseDto {
  @ApiProperty({ description: 'Identificador único del evento' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'UUID público del evento' })
  @Expose()
  publicUuid: string;

  @ApiProperty({ description: 'Slug amigable único para SEO y Landing Page' })
  @Expose()
  slug: string;

  @ApiProperty({ description: 'Título comercial del evento' })
  @Expose()
  title: string;

  @ApiProperty({ description: 'Categoría oficial del evento' })
  @Expose()
  category: string;

  @ApiProperty({ description: 'Sinopsis o descripción corta' })
  @Expose()
  description: string | null;

  @ApiProperty({ description: 'Recinto, estadio o local' })
  @Expose()
  venue: string | null;

  @ApiProperty({ description: 'URL del banner de alta resolución' })
  @Expose()
  bannerUrl: string | null;

  @ApiProperty({ description: 'Fecha y hora de inicio de la función' })
  @Expose()
  date: string | null;

  @ApiProperty({ description: 'Precio mínimo desde' })
  @Expose()
  minPrice: number;

  @ApiProperty({ description: 'Si cuenta con landing page dedicada' })
  @Expose()
  hasLandingPage: boolean;

  @ApiProperty({ description: 'Si está marcado como destacado editorial' })
  @Expose()
  isFeatured: boolean;
}

