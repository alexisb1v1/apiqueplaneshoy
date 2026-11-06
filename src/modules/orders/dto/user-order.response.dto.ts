import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class UserOrderTicketDto {
  @Expose()
  @ApiProperty({ description: 'ID interno del boleto', example: '101' })
  ticketId: string;

  @Expose()
  @ApiProperty({ description: 'UUID público del boleto', example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  ticketUuid: string;

  @Expose()
  @ApiProperty({ description: 'Número correlativo dentro de la orden', example: 1 })
  ticketNumber: number;

  @Expose()
  @ApiProperty({ description: 'Nombre de la zona asignada', example: 'Zona VIP' })
  zoneName: string;

  @Expose()
  @ApiProperty({ description: 'Nombre de la tarifa o preventa', example: 'Preventa Early Bird' })
  tierName: string;

  @Expose()
  @ApiProperty({ description: 'Precio unitario pagado', example: 120.0 })
  unitPrice: number;

  @Expose()
  @ApiProperty({ description: 'Payload del código QR firmado', example: 'QPH|ORD:12|TCK:101|SIG:...' })
  qrPayload: string;

  @Expose()
  @ApiProperty({ description: 'Estado del ticket: sold, used, cancelled', example: 'sold' })
  status: string;
}

@Exclude()
export class UserOrderResponseDto {
  @Expose()
  @ApiProperty({ description: 'ID numérico interno de la orden', example: '5' })
  orderId: string;

  @Expose()
  @ApiProperty({ description: 'Código institucional visible de la orden', example: '#QPH-000005' })
  orderCode: string;

  @Expose()
  @ApiProperty({ description: 'UUID público de la orden', example: 'f391a27e-8c54-4b9f-b98a-1123456789ab' })
  orderUuid: string;

  @Expose()
  @ApiProperty({ description: 'Fecha ISO de creación de la compra' })
  orderDate: string;

  @Expose()
  @ApiProperty({ description: 'Monto total pagado en Soles (S/.)', example: 240.0 })
  totalAmount: number;

  @Expose()
  @ApiProperty({ description: 'Estado de la orden', example: 'paid' })
  status: string;

  @Expose()
  @ApiProperty({ description: 'Método de pago procesado', example: 'Tarjeta de crédito' })
  paymentMethod: string;

  @Expose()
  @ApiProperty({ description: 'Código de transacción de pago', example: 'TX-535861' })
  txCode: string;

  @Expose()
  @ApiProperty({ description: 'Cantidad total de entradas en la orden', example: 2 })
  ticketCount: number;

  @Expose()
  @ApiProperty({ description: 'ID del evento', example: '1' })
  eventId: string;

  @Expose()
  @ApiProperty({ description: 'Título del evento', example: 'Bareto en Concierto' })
  eventTitle: string;

  @Expose()
  @ApiProperty({ description: 'Slug del evento para enlaces amigables', example: 'bareto-en-concierto' })
  eventSlug: string;

  @Expose()
  @ApiProperty({ description: 'Indica si el evento tiene landing page inmersiva habilitada', example: true })
  hasLandingPage: boolean;

  @Expose()
  @ApiProperty({ description: 'Categoría del evento', example: 'CONCERTS' })
  category: string;

  @Expose()
  @ApiProperty({ description: 'Recinto o local oficial', example: 'Campo Ferial' })
  venueName: string;

  @Expose()
  @ApiProperty({ description: 'Dirección física del recinto', example: 'Av. Yarinacocha 954' })
  venueAddress: string;

  @Expose()
  @ApiProperty({ description: 'Ciudad donde se realiza el evento', example: 'Pucallpa' })
  city: string;

  @Expose()
  @ApiProperty({ description: 'URL del banner oficial', nullable: true })
  bannerImageUrl: string | null;

  @Expose()
  @ApiProperty({ description: 'Fecha legible del espectáculo', example: 'Lunes, 30 de noviembre, 2026' })
  eventDateFormatted: string;

  @Expose()
  @ApiProperty({ description: 'Horario oficial de la función', example: '10:00 p. m.' })
  eventTimeFormatted: string;

  @Expose()
  @ApiProperty({ description: 'Fecha ISO de la función para ordenación y filtros' })
  showStartTimeIso: string;

  @Expose()
  @ApiProperty({ description: 'Indica si el evento ya pasó de fecha', example: false })
  isPast: boolean;

  @Expose()
  @ApiProperty({ description: 'Nombre de la zona adquirida', example: 'GENERAL' })
  zoneName: string;

  @Expose()
  @Type(() => UserOrderTicketDto)
  @ApiProperty({ description: 'Lista de tickets oficiales asociados a esta orden', type: [UserOrderTicketDto] })
  tickets: UserOrderTicketDto[];
}

