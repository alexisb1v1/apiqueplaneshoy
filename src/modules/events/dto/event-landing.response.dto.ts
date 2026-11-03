import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class LandingThemeDto {
  @Expose()
  @ApiProperty({ example: '#6366F1' })
  primaryColor!: string;

  @Expose()
  @ApiProperty({ example: 'color', enum: ['color', 'pattern'] })
  backgroundType!: 'color' | 'pattern';

  @Expose()
  @ApiProperty({ example: '#18181B' })
  backgroundColor!: string;

  @Expose()
  @ApiProperty({ example: 'https://pub-xxxx.r2.dev/landings/pattern.png', nullable: true })
  backgroundPatternUrl?: string | null;
}

@Exclude()
export class LandingHeaderDto {
  @Expose()
  @ApiProperty({ example: 'CAJACHO FEST LOS OLIVOS' })
  title?: string;

  @Expose()
  @ApiProperty({ example: 'EXPERIENCIA EXCLUSIVA' })
  subtitle?: string;

  @Expose()
  @ApiProperty({ example: 'Comprar Entradas Oficiales' })
  ctaText?: string;

  @Expose()
  @ApiProperty({ example: 'https://pub-xxxx.r2.dev/landings/header.jpg', nullable: true })
  headerImageUrl?: string | null;

  @Expose()
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=xxxx', nullable: true })
  videoTeaserUrl?: string | null;
}

@Exclude()
export class LandingBodyDto {
  @Expose()
  @ApiProperty({ example: 'Sinopsis o detalle del evento', nullable: true })
  aboutText?: string | null;

  @Expose()
  @ApiProperty({ example: 'https://pub-xxxx.r2.dev/landings/body.png', nullable: true })
  bodyImageUrl?: string | null;

  @Expose()
  @ApiProperty({ example: '3 Escenarios y Zonas Exclusivas', nullable: true })
  highlight1?: string | null;

  @Expose()
  @ApiProperty({ example: 'Patio Gastronómico Gourmet', nullable: true })
  highlight2?: string | null;

  @Expose()
  @ApiProperty({ example: 'Seguridad y Accesos Preferenciales', nullable: true })
  highlight3?: string | null;

  @Expose()
  @ApiProperty({ example: 'Estacionamiento privado vigilado', nullable: true })
  highlight4?: string | null;
}

@Exclude()
export class LandingFooterDto {
  @Expose()
  @ApiProperty({ example: 'https://pub-xxxx.r2.dev/landings/footer.jpg', nullable: true })
  footerImageUrl?: string | null;

  @Expose()
  @ApiProperty({ example: 'https://tiktok.com/@cajachofest', nullable: true })
  tiktokUrl?: string | null;

  @Expose()
  @ApiProperty({ example: 'https://facebook.com/cajachofest', nullable: true })
  facebookUrl?: string | null;

  @Expose()
  @ApiProperty({ example: 'https://instagram.com/cajachofest', nullable: true })
  instagramUrl?: string | null;
}

@Exclude()
export class LandingConfigDto {
  @Expose()
  @Type(() => LandingThemeDto)
  theme!: LandingThemeDto;

  @Expose()
  @Type(() => LandingHeaderDto)
  header!: LandingHeaderDto;

  @Expose()
  @Type(() => LandingBodyDto)
  body!: LandingBodyDto;

  @Expose()
  @Type(() => LandingFooterDto)
  footer!: LandingFooterDto;
}

@Exclude()
export class LandingShowDto {
  @Expose()
  id!: string;

  @Expose()
  publicUuid!: string;

  @Expose()
  name!: string | null;

  @Expose()
  startTime!: string;

  @Expose()
  durationHours!: number;
}

@Exclude()
export class LandingZoneDto {
  @Expose()
  id!: string;

  @Expose()
  publicUuid!: string;

  @Expose()
  name!: string;

  @Expose()
  title!: string | null;

  @Expose()
  color!: string;

  @Expose()
  benefits!: string | null;

  @Expose()
  regularPrice!: number;

  @Expose()
  currentPrice!: number;

  @Expose()
  activeTierName!: string;

  @Expose()
  capacity!: number;

  @Expose()
  remainingTickets!: number;

  @Expose()
  isSoldOut!: boolean;
}

@Exclude()
export class EventLandingResponseDto {
  @Expose()
  id!: string;

  @Expose()
  publicUuid!: string;

  @Expose()
  slug!: string;

  @Expose()
  name!: string;

  @Expose()
  category!: string;

  @Expose()
  venue!: string | null;

  @Expose()
  address!: string | null;

  @Expose()
  city!: string;

  @Expose()
  hasLandingPage!: boolean;

  @Expose()
  bannerUrl!: string | null;

  @Expose()
  termsAndConditionsUrl!: string | null;

  @Expose()
  ageRestriction!: string;

  @Expose()
  @Type(() => LandingConfigDto)
  landingConfig!: LandingConfigDto;

  @Expose()
  @Type(() => LandingShowDto)
  shows!: LandingShowDto[];

  @Expose()
  @Type(() => LandingZoneDto)
  zones!: LandingZoneDto[];
}

