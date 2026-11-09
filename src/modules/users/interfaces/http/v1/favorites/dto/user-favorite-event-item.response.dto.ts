import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserFavoriteEventItemResponseDto {
  @ApiProperty({ example: '1', description: 'ID numérico interno del evento' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'UUID público del evento' })
  @Expose()
  publicUuid: string;

  @ApiProperty({ example: 'corazon-serrano-pucallpa-2026', description: 'Slug amigable para SEO' })
  @Expose()
  slug: string;

  @ApiProperty({ example: 'Gran Concierto de Verano', description: 'Título comercial del evento' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'CONCERTS', description: 'Categoría oficial del evento' })
  @Expose()
  category: string;

  @ApiProperty({ example: 'https://cdn.queplaneshoy.com/banners/banner.webp', description: 'URL de la imagen de portada' })
  @Expose()
  imageUrl: string;

  @ApiProperty({ example: 'Explanada del Estadio Municipal', description: 'Local o recinto' })
  @Expose()
  venue: string;

  @ApiProperty({ example: 'Pucallpa', description: 'Ciudad del evento según ubigeo' })
  @Expose()
  city: string;

  @ApiProperty({ example: '2026-03-15T20:00:00.000Z', description: 'Fecha y hora de la función más próxima', nullable: true })
  @Expose()
  nextShowDate: string | null;

  @ApiProperty({ example: 45.0, description: 'Precio mínimo de lista desde' })
  @Expose()
  minPrice: number;

  @ApiProperty({ example: '2026-02-01T12:00:00.000Z', description: 'Fecha y hora en que se guardó en favoritos' })
  @Expose()
  favoritedAt: string;
}

