import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class UrgencyBadgeDto {
  @Expose()
  @ApiProperty({ example: 'Últimas 45 entradas', description: 'Texto del badge de urgencia' })
  text!: string;

  @Expose()
  @ApiProperty({
    example: 'critical',
    enum: ['critical', 'high_demand', 'warning', 'info'],
    description: 'Nivel de urgencia para estilizado en UI',
  })
  type!: 'critical' | 'high_demand' | 'warning' | 'info';

  @Expose()
  @ApiProperty({
    example: 'hourglass_top',
    description: 'Nombre del icono Material Symbols (hourglass_top, local_fire_department, stars, bolt)',
  })
  icon!: string;
}

@Exclude()
export class HomeEventCardResponseDto {
  @Expose()
  @ApiProperty({ example: '105', description: 'Identificador numérico del evento' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'a9b2c3d4-e5f6-4a1b-8c2d-9e0f1a2b3c4d', description: 'UUID público seguro' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'cumbia-all-stars-amigos', description: 'Slug amigable para SEO' })
  slug!: string;

  @Expose()
  @ApiProperty({ example: false, description: 'Indica si tiene Landing Page inmersiva' })
  hasLandingPage!: boolean;

  @Expose()
  @ApiProperty({ example: 'Cumbia All Stars & Amigos', description: 'Título comercial del evento' })
  title!: string;

  @Expose()
  @ApiProperty({ example: 'CONCERTS', description: 'Categoría oficial normalizada' })
  category!: string;

  @Expose()
  @ApiProperty({
    example: 'https://pub-xxxx.r2.dev/banners/cumbia.webp',
    description: 'URL de la imagen de portada en Cloudflare R2',
    nullable: true,
  })
  imageUrl!: string | null;

  @Expose()
  @ApiProperty({
    example: '2026-11-05T20:00:00.000Z',
    description: 'Fecha ISO de inicio de la función más próxima',
    nullable: true,
  })
  date!: string | null;

  @Expose()
  @ApiProperty({ example: 'LIMA', description: 'Ciudad resuelta según código ubigeo INEI' })
  city!: string;

  @Expose()
  @ApiProperty({ example: 'Explanada Estadio Nacional', description: 'Recinto o local', nullable: true })
  venue!: string | null;

  @Expose()
  @ApiProperty({ example: 'Una noche inolvidable al ritmo de la cumbia clásica...', description: 'Sinopsis corta' })
  description!: string | null;

  @Expose()
  @ApiProperty({ example: 35.0, description: 'Menor precio disponible entre las zonas activas' })
  minPrice!: number;

  @Expose()
  @ApiProperty({ example: 'GENERAL', description: 'Tipo de entrada destacada disponible (GENERAL, VIP DISPONIBLE, PLATINUM)' })
  ticketType!: string;

  @Expose()
  @ApiProperty({
    example: 'general',
    enum: ['general', 'vip', 'platinum', 'error'],
    description: 'Estilo visual de la píldora de tipo de entrada',
  })
  ticketBadgeStyle!: 'general' | 'vip' | 'platinum' | 'error';

  @Expose()
  @Type(() => UrgencyBadgeDto)
  @ApiProperty({ type: UrgencyBadgeDto, description: 'Indicador dinámico de urgencia basado en aforo real' })
  urgencyBadge!: UrgencyBadgeDto;
}

