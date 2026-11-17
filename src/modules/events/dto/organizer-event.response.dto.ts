import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class OrganizerEventZoneResponseDto {
  @Expose()
  @ApiProperty({ example: '12' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'VIP Central' })
  name!: string;

  @Expose()
  @ApiProperty({ example: 'Zona VIP', nullable: true })
  title!: string | null;

  @Expose()
  @ApiProperty({ example: '#6366F1' })
  color!: string;

  @Expose()
  @ApiProperty({ example: 500 })
  capacity!: number;

  @Expose()
  @ApiProperty({ example: 320 })
  soldCount!: number;

  @Expose()
  @ApiProperty({ example: 4 })
  lockedCount!: number;

  @Expose()
  @ApiProperty({ example: 176 })
  remainingTickets!: number;

  @Expose()
  @ApiProperty({ example: 64.0 })
  occupancyPercentage!: number;

  @Expose()
  @ApiProperty({ example: 120.0 })
  regularPrice!: number;

  @Expose()
  @ApiProperty({ example: 95.0 })
  activePrice!: number;

  @Expose()
  @ApiProperty({ example: 'Preventa 1' })
  activeTierName!: string;

  @Expose()
  @ApiProperty({ example: true })
  isPresaleActive!: boolean;

  @Expose()
  @ApiProperty({ example: 'Alta demanda' })
  statusBadge!: string;

  @Expose()
  @ApiProperty({ example: 30400.0 })
  revenue!: number;
}

@Exclude()
export class OrganizerDraftChecklistDto {
  @Expose()
  @ApiProperty({ example: true })
  hasShows!: boolean;

  @Expose()
  @ApiProperty({ example: true })
  hasZones!: boolean;

  @Expose()
  @ApiProperty({ example: true })
  hasBanner!: boolean;

  @Expose()
  @ApiProperty({ example: 100 })
  completionPercent!: number;

  @Expose()
  @ApiProperty({ example: [] })
  missingItems!: string[];
}

@Exclude()
export class OrganizerEventResponseDto {
  @Expose()
  @ApiProperty({ example: '42' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'b3f4b577-12ab-4cde-9012-abcdef123456' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: '#EV-B3F4B577' })
  eventCode!: string;

  @Expose()
  @ApiProperty({ example: 'armonia-10-pucallpa-2026' })
  slug!: string;

  @Expose()
  @ApiProperty({ example: 'Armonía 10 - La Primerísima en Vivo' })
  name!: string;

  @Expose()
  @ApiProperty({ example: 'CONCERTS' })
  category!: string;

  @Expose()
  @ApiProperty({ example: 'published' })
  status!: string;

  @Expose()
  @ApiProperty({ example: 'Falta adjuntar permiso municipal', nullable: true })
  observationReason!: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isSoldOut!: boolean;

  @Expose()
  @ApiProperty({ example: 'En Venta • Preventa 1' })
  statusLabel!: string;

  @Expose()
  @ApiProperty({ example: true })
  hasLandingPage!: boolean;

  @Expose()
  @ApiProperty({ example: 'https://pub-xxx.r2.dev/banners/event.webp', nullable: true })
  imageUrl!: string | null;

  @Expose()
  @ApiProperty({ example: 'Estadio Aliardo Soria Pérez', nullable: true })
  venue!: string | null;

  @Expose()
  @ApiProperty({ example: 'Pucallpa' })
  city!: string;

  @Expose()
  @ApiProperty({ example: '2026-11-20T20:00:00.000Z', nullable: true })
  firstShowStartTime!: string | null;

  @Expose()
  @ApiProperty({ example: '20 de noviembre 2026' })
  dateFormatted!: string;

  @Expose()
  @ApiProperty({ example: 1 })
  showsCount!: number;

  @Expose()
  @ApiProperty({ example: 1500 })
  capacity!: number;

  @Expose()
  @ApiProperty({ example: 980 })
  ticketsSold!: number;

  @Expose()
  @ApiProperty({ example: 520 })
  remainingTickets!: number;

  @Expose()
  @ApiProperty({ example: 65.3 })
  occupancyPercentage!: number;

  @Expose()
  @ApiProperty({ example: 74200.0 })
  grossRevenue!: number;

  @Expose()
  @ApiProperty({ example: 1200.0 })
  couponsDiscountAmount!: number;

  @Expose()
  @ApiProperty({ example: 73000.0 })
  netSalesRevenue!: number;

  @Expose()
  @ApiProperty({ example: 112500.0 })
  targetRevenue!: number;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  settlementStatus!: string | null;

  @Expose()
  @ApiProperty({ example: 0 })
  advancesCount!: number;

  @Expose()
  @ApiProperty({ example: '2026-11-10T15:30:00.000Z' })
  createdAt!: string;

  @Expose()
  @Type(() => OrganizerDraftChecklistDto)
  @ApiProperty({ type: OrganizerDraftChecklistDto })
  draftChecklist!: OrganizerDraftChecklistDto;

  @Expose()
  @Type(() => OrganizerEventZoneResponseDto)
  @ApiProperty({ type: [OrganizerEventZoneResponseDto] })
  zones!: OrganizerEventZoneResponseDto[];
}

