import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class EventShowDto {
  @Expose()
  @ApiProperty({ example: '1' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'b1c2d3e4-f5a6-7890-abcd-ef1234567890' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'Función Principal', nullable: true })
  name!: string | null;

  @Expose()
  @ApiProperty({ example: '2026-11-20T20:00:00.000Z' })
  startTime!: string;

  @Expose()
  @ApiProperty({ example: 3 })
  durationHours!: number;
}

@Exclude()
export class EventZoneDto {
  @Expose()
  @ApiProperty({ example: '10' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'z1x2c3v4-b5n6-7m8l-9k0j-1h2g3f4d5s6a' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'VIP Central' })
  name!: string;

  @Expose()
  @ApiProperty({ example: 'Vista Preferencial', nullable: true })
  title!: string | null;

  @Expose()
  @ApiProperty({ example: '#4F46E5' })
  color!: string;

  @Expose()
  @ApiProperty({ example: 'Acceso sin colas, barra exclusiva', nullable: true })
  benefits!: string | null;

  @Expose()
  @ApiProperty({ example: 120.0 })
  regularPrice!: number;

  @Expose()
  @ApiProperty({ example: 95.0 })
  currentPrice!: number;

  @Expose()
  @ApiProperty({ example: 9.5 })
  serviceFee!: number;

  @Expose()
  @ApiProperty({ example: false })
  feeIncluded!: boolean;

  @Expose()
  @ApiProperty({ example: 'Preventa Early Bird' })
  activeTierName!: string;

  @Expose()
  @ApiProperty({ example: 500 })
  capacity!: number;

  @Expose()
  @ApiProperty({ example: 45 })
  remainingTickets!: number;

  @Expose()
  @ApiProperty({ example: false })
  isSoldOut!: boolean;

  @Expose()
  @ApiProperty({ example: 4 })
  maxTicketsPerOrder!: number;
}

@Exclude()
export class EventDetailResponseDto {
  @Expose()
  @ApiProperty({ example: '105' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'a9b2c3d4-e5f6-4a1b-8c2d-9e0f1a2b3c4d' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'bareto-en-concierto-la-noche' })
  slug!: string;

  @Expose()
  @ApiProperty({ example: 'BARETO EN CONCIERTO' })
  name!: string;

  @Expose()
  @ApiProperty({ example: 'CONCERTS' })
  category!: string;

  @Expose()
  @ApiProperty({ example: 'Show íntimo de cumbia fusión...', nullable: true })
  description!: string | null;

  @Expose()
  @ApiProperty({ example: 'La Noche de Barranco', nullable: true })
  venue!: string | null;

  @Expose()
  @ApiProperty({ example: 'Pje. Sánchez Carrión 199, Barranco', nullable: true })
  address!: string | null;

  @Expose()
  @ApiProperty({ example: 'LIMA' })
  city!: string;

  @Expose()
  @ApiProperty({ example: true })
  hasLandingPage!: boolean;

  @Expose()
  @ApiProperty({ example: 'https://pub-xxxx.r2.dev/banners/bareto.webp', nullable: true })
  bannerUrl!: string | null;

  @Expose()
  @ApiProperty({ example: 'https://pub-xxxx.r2.dev/maps/croquis-recinto.webp', nullable: true })
  zoneMapUrl!: string | null;

  @Expose()
  @ApiProperty({ example: 'https://pub-xxxx.r2.dev/docs/bases.pdf', nullable: true })
  termsAndConditionsUrl!: string | null;

  @Expose()
  @ApiProperty({ example: 'PLUS_18' })
  ageRestriction!: string;

  @Expose()
  @ApiProperty({ example: 4 })
  userTicketLimit!: number;

  @Expose()
  @ApiProperty({ example: 'Apertura de puertas 20:00 hrs', nullable: true })
  openingHoursComment!: string | null;

  @Expose()
  @ApiProperty({ example: 'DNI físico o digital obligatorio', nullable: true })
  entryRequirements!: string | null;

  @Expose()
  @ApiProperty({ example: 'https://maps.google.com/?q=...', nullable: true })
  googleMapsUrl!: string | null;

  @Expose()
  @ApiProperty({ example: '-12.046374, -77.042793', nullable: true })
  coordinates!: string | null;

  @Expose()
  @ApiProperty({ example: 'Frente al Real Plaza', nullable: true })
  addressReference!: string | null;

  @Expose()
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=xxxx', nullable: true })
  promoVideoUrl!: string | null;

  @Expose()
  @ApiProperty({
    example: { instagramUrl: 'https://instagram.com/...', facebookUrl: 'https://facebook.com/...', tiktokUrl: 'https://tiktok.com/@...' },
    nullable: true,
  })
  socialLinks!: {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    tiktokUrl?: string | null;
  } | null;

  @Expose()
  @Type(() => EventShowDto)
  @ApiProperty({ type: [EventShowDto] })
  shows!: EventShowDto[];

  @Expose()
  @Type(() => EventZoneDto)
  @ApiProperty({ type: [EventZoneDto] })
  zones!: EventZoneDto[];
}

