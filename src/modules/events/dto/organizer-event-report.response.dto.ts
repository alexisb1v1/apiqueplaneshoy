import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class OrganizerEventReportEventDto {
  @Expose()
  @ApiProperty({ example: '15' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'b3f54562-b912-4217-a068-15a0cbb08fa7' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'concierto-rock-2026' })
  slug!: string;

  @Expose()
  @ApiProperty({ example: 'Gran Concierto de Rock' })
  name!: string;

  @Expose()
  @ApiProperty({ example: 'CONCERTS' })
  category!: string;

  @Expose()
  @ApiProperty({ example: 'published' })
  status!: string;

  @Expose()
  @ApiProperty({ example: 'Publicado' })
  statusLabel!: string;

  @Expose()
  @ApiProperty({ example: '#EV-B3F54562' })
  eventCode!: string;

  @Expose()
  @ApiProperty({ example: 'Estadio Nacional', nullable: true })
  venue!: string | null;

  @Expose()
  @ApiProperty({ example: 'Av. José Díaz s/n', nullable: true })
  address!: string | null;

  @Expose()
  @ApiProperty({ example: 'Lima' })
  city!: string;

  @Expose()
  @ApiProperty({ example: 'https://images.unsplash.com/...', nullable: true })
  imageUrl!: string | null;

  @Expose()
  @ApiProperty({ example: true })
  hasLandingPage!: boolean;

  @Expose()
  @ApiProperty({
    example: 'buyer',
    description: 'A quién se le cobra la comisión: "promoter", "buyer" o "mixed"',
  })
  feeChargedTo!: 'promoter' | 'buyer' | 'mixed';

  @Expose()
  @ApiProperty({ example: '2026-11-01T12:00:00.000Z' })
  createdAt!: string;

  @Expose()
  @ApiProperty({ example: 'requested', nullable: true, description: 'Estado actual de la liquidación de fondos' })
  settlementStatus!: string | null;

  @Expose()
  @ApiProperty({ example: 'En Revisión (24h - 72h)', nullable: true })
  settlementStatusLabel!: string | null;

  @Expose()
  @ApiProperty({ example: 1850.50, nullable: true })
  settlementAmount!: number | null;

  @Expose()
  @ApiProperty({ example: 'BCP', nullable: true })
  settlementBankName!: string | null;

  @Expose()
  @ApiProperty({ example: '2026-11-18T20:00:00.000Z', nullable: true })
  settlementRequestedAt!: string | null;
}

@Exclude()
export class OrganizerEventReportSummaryDto {
  @Expose()
  @ApiProperty({ example: 5000, description: 'Aforo total del evento (suma de zonas)' })
  totalCapacity!: number;

  @Expose()
  @ApiProperty({ example: 3420, description: 'Total de boletos confirmados vendidos (sold o used)' })
  ticketsSold!: number;

  @Expose()
  @ApiProperty({ example: 1250, description: 'Boletos validados / escaneados en puerta (used)' })
  ticketsUsed!: number;

  @Expose()
  @ApiProperty({ example: 1580, description: 'Boletos disponibles restantes' })
  ticketsRemaining!: number;

  @Expose()
  @ApiProperty({ example: 68.4, description: 'Porcentaje de ocupación respecto a capacidad' })
  occupancyPercentage!: number;

  @Expose()
  @ApiProperty({ example: 36.5, description: 'Porcentaje de boletos escaneados sobre los vendidos' })
  checkInPercentage!: number;

  @Expose()
  @ApiProperty({ example: 342000.0, description: 'Recaudación bruta nominal' })
  grossRevenue!: number;

  @Expose()
  @ApiProperty({ example: 20520.0, description: 'Comisiones acumuladas de ticketera' })
  totalServiceFee!: number;

  @Expose()
  @ApiProperty({ example: 4500.0, description: 'Descuentos acumulados por cupones de compra' })
  couponsDiscountAmount!: number;

  @Expose()
  @ApiProperty({ example: 337500.0, description: 'Recaudación neta de ventas (Bruto - Cupones)' })
  netSalesRevenue!: number;

  @Expose()
  @ApiProperty({ example: 98.68, description: 'Ticket promedio vendido' })
  averageTicketPrice!: number;

  @Expose()
  @ApiProperty({ example: 450000.0, description: 'Ingreso objetivo al 100% de venta regular' })
  targetRevenue!: number;

  @Expose()
  @ApiProperty({ example: 75.0, description: 'Progreso hacia el objetivo de recaudación' })
  targetRevenuePercentage!: number;

  @Expose()
  @ApiProperty({ example: 1650, description: 'Total de órdenes pagadas únicas' })
  totalOrdersCount!: number;
}

@Exclude()
export class OrganizerEventReportTierDto {
  @Expose()
  @ApiProperty({ example: 1 })
  tierNumber!: number;

  @Expose()
  @ApiProperty({ example: 'Preventa 1 (Early Bird)' })
  name!: string;

  @Expose()
  @ApiProperty({ example: 85.0 })
  price!: number;

  @Expose()
  @ApiProperty({ example: 200 })
  capacity!: number;

  @Expose()
  @ApiProperty({ example: 200 })
  soldCount!: number;

  @Expose()
  @ApiProperty({ example: '2026-11-20T23:59:59.000Z', nullable: true })
  endAt!: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isActive!: boolean;

  @Expose()
  @ApiProperty({ example: 'Agotado' })
  statusBadge!: string;
}

@Exclude()
export class OrganizerEventReportZoneDto {
  @Expose()
  @ApiProperty({ example: '10' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'Platinum VIP' })
  name!: string;

  @Expose()
  @ApiProperty({ example: '#6366F1' })
  color!: string;

  @Expose()
  @ApiProperty({ example: 500 })
  capacity!: number;

  @Expose()
  @ApiProperty({ example: 420 })
  soldCount!: number;

  @Expose()
  @ApiProperty({ example: 180 })
  usedCount!: number;

  @Expose()
  @ApiProperty({ example: 80 })
  remainingTickets!: number;

  @Expose()
  @ApiProperty({ example: 84.0 })
  occupancyPercentage!: number;

  @Expose()
  @ApiProperty({ example: 150.0 })
  regularPrice!: number;

  @Expose()
  @ApiProperty({ example: 120.0 })
  activePrice!: number;

  @Expose()
  @ApiProperty({ example: 'Preventa 2' })
  activeTierName!: string;

  @Expose()
  @ApiProperty({ example: true })
  isPresaleActive!: boolean;

  @Expose()
  @ApiProperty({ example: 54600.0 })
  revenue!: number;

  @Expose()
  @ApiProperty({ example: false })
  feeIncluded!: boolean;

  @Expose()
  @ApiProperty({ example: 8.0 })
  serviceFee!: number;

  @Expose()
  @Type(() => OrganizerEventReportTierDto)
  @ApiProperty({ type: [OrganizerEventReportTierDto] })
  tiers!: OrganizerEventReportTierDto[];
}

@Exclude()
export class OrganizerEventReportShowDto {
  @Expose()
  @ApiProperty({ example: '5' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'c1d2e3f4-g5h6-7890-abcd-ef1234567890' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: 'Función Principal - Sábado 21:00' })
  name!: string;

  @Expose()
  @ApiProperty({ example: '2026-12-15T21:00:00.000Z' })
  startTime!: string;

  @Expose()
  @ApiProperty({ example: '15 dic 2026 • 09:00 PM' })
  dateFormatted!: string;

  @Expose()
  @ApiProperty({ example: '2026-12-15T22:00:00.000Z', nullable: true })
  salesEndAt!: string | null;

  @Expose()
  @ApiProperty({ example: 3 })
  durationHours!: number;

  @Expose()
  @ApiProperty({ example: 'scheduled' })
  status!: string;

  @Expose()
  @ApiProperty({ example: 2800 })
  ticketsSold!: number;

  @Expose()
  @ApiProperty({ example: 950 })
  ticketsUsed!: number;
}

@Exclude()
export class OrganizerEventReportRecentOrderDto {
  @Expose()
  @ApiProperty({ example: '24' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'd1e2f3g4-h5i6-7890-abcd-ef1234567890' })
  publicUuid!: string;

  @Expose()
  @ApiProperty({ example: '#ORD-D1E2F3G4' })
  orderCode!: string;

  @Expose()
  @ApiProperty({ example: '2026-11-18T10:30:00.000Z' })
  createdAt!: string;

  @Expose()
  @ApiProperty({ example: 'Juan Pérez' })
  buyerName!: string;

  @Expose()
  @ApiProperty({ example: 'juan.perez@example.com' })
  buyerEmail!: string;

  @Expose()
  @ApiProperty({ example: 3 })
  ticketsCount!: number;

  @Expose()
  @ApiProperty({ example: '2x VIP Central, 1x General' })
  zonesSummary!: string;

  @Expose()
  @ApiProperty({ example: 250.0 })
  subtotal!: number;

  @Expose()
  @ApiProperty({ example: 25.0 })
  discountAmount!: number;

  @Expose()
  @ApiProperty({ example: 'ROCK10', nullable: true })
  couponCode!: string | null;

  @Expose()
  @ApiProperty({ example: 225.0 })
  totalAmount!: number;

  @Expose()
  @ApiProperty({ example: 'culqi_card' })
  paymentMethod!: string;

  @Expose()
  @ApiProperty({ example: 'paid' })
  status!: string;
}

@Exclude()
export class OrganizerEventReportDailyZoneSalesDto {
  @Expose()
  @ApiProperty({ example: '10' })
  zoneId!: string;

  @Expose()
  @ApiProperty({ example: 'VIP Central' })
  zoneName!: string;

  @Expose()
  @ApiProperty({ example: '#6366F1' })
  color!: string;

  @Expose()
  @ApiProperty({ example: 15 })
  ticketsSold!: number;

  @Expose()
  @ApiProperty({ example: 2250.0 })
  revenue!: number;
}

@Exclude()
export class OrganizerEventReportDailySalesDto {
  @Expose()
  @ApiProperty({ example: '2026-11-15' })
  date!: string;

  @Expose()
  @ApiProperty({ example: 45 })
  ticketsSold!: number;

  @Expose()
  @ApiProperty({ example: 5400.0 })
  revenue!: number;

  @Expose()
  @Type(() => OrganizerEventReportDailyZoneSalesDto)
  @ApiProperty({ type: [OrganizerEventReportDailyZoneSalesDto] })
  zones!: OrganizerEventReportDailyZoneSalesDto[];
}

@Exclude()
export class OrganizerEventReportTrafficSourceDto {
  @Expose()
  @ApiProperty({ example: 'Instagram' })
  source!: string;

  @Expose()
  @ApiProperty({ example: 120 })
  visitors!: number;

  @Expose()
  @ApiProperty({ example: 45.5 })
  percentage!: number;
}

@Exclude()
export class OrganizerEventReportFunnelStepDto {
  @Expose()
  @ApiProperty({ example: 'Visitas al Evento' })
  step!: string;

  @Expose()
  @ApiProperty({ example: 500 })
  count!: number;

  @Expose()
  @ApiProperty({ example: 100.0 })
  percentage!: number;

  @Expose()
  @ApiProperty({ example: 25.0 })
  dropOffPercentage!: number;
}

@Exclude()
export class OrganizerEventReportFunnelDto {
  @Expose()
  @ApiProperty({ example: 1250 })
  pageviews!: number;

  @Expose()
  @ApiProperty({ example: 840 })
  uniqueVisitors!: number;

  @Expose()
  @ApiProperty({ example: 180 })
  checkoutInitiated!: number;

  @Expose()
  @ApiProperty({ example: 45 })
  ordersPaid!: number;

  @Expose()
  @ApiProperty({ example: 5.35 })
  conversionRate!: number;

  @Expose()
  @Type(() => OrganizerEventReportFunnelStepDto)
  @ApiProperty({ type: [OrganizerEventReportFunnelStepDto] })
  steps!: OrganizerEventReportFunnelStepDto[];

  @Expose()
  @Type(() => OrganizerEventReportTrafficSourceDto)
  @ApiProperty({ type: [OrganizerEventReportTrafficSourceDto] })
  trafficSources!: OrganizerEventReportTrafficSourceDto[];
}

@Exclude()
export class OrganizerEventReportResponseDto {
  @Expose()
  @Type(() => OrganizerEventReportEventDto)
  @ApiProperty({ type: OrganizerEventReportEventDto })
  event!: OrganizerEventReportEventDto;

  @Expose()
  @Type(() => OrganizerEventReportSummaryDto)
  @ApiProperty({ type: OrganizerEventReportSummaryDto })
  summary!: OrganizerEventReportSummaryDto;

  @Expose()
  @Type(() => OrganizerEventReportZoneDto)
  @ApiProperty({ type: [OrganizerEventReportZoneDto] })
  zones!: OrganizerEventReportZoneDto[];

  @Expose()
  @Type(() => OrganizerEventReportShowDto)
  @ApiProperty({ type: [OrganizerEventReportShowDto] })
  shows!: OrganizerEventReportShowDto[];

  @Expose()
  @Type(() => OrganizerEventReportRecentOrderDto)
  @ApiProperty({ type: [OrganizerEventReportRecentOrderDto] })
  recentOrders!: OrganizerEventReportRecentOrderDto[];

  @Expose()
  @Type(() => OrganizerEventReportDailySalesDto)
  @ApiProperty({ type: [OrganizerEventReportDailySalesDto] })
  dailySales!: OrganizerEventReportDailySalesDto[];

  @Expose()
  @Type(() => OrganizerEventReportFunnelDto)
  @ApiProperty({ type: OrganizerEventReportFunnelDto, nullable: true })
  funnel!: OrganizerEventReportFunnelDto | null;
}
