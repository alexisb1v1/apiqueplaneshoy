import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { GetMyOrdersQuery } from '../impl/get-my-orders.query';
import { UserOrderResponseDto, UserOrderTicketDto } from '../../dto/user-order.response.dto';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { plainToInstance } from 'class-transformer';

@QueryHandler(GetMyOrdersQuery)
export class GetMyOrdersHandler implements IQueryHandler<GetMyOrdersQuery> {
  private readonly logger = new Logger(GetMyOrdersHandler.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async execute(query: GetMyOrdersQuery): Promise<UserOrderResponseDto[]> {
    try {
      const orders = await this.orderRepository
        .createQueryBuilder('order')
        .innerJoinAndSelect('order.tickets', 'tickets')
        .innerJoinAndSelect('tickets.show', 'show')
        .innerJoinAndSelect('show.event', 'event')
        .leftJoinAndSelect('event.images', 'images')
        .innerJoinAndSelect('tickets.zone', 'zone')
        .leftJoinAndSelect('tickets.pricingTier', 'pricingTier')
        .leftJoinAndSelect('order.payments', 'payments')
        .where('order.userId = :userId', { userId: query.userId })
        .andWhere('order.status = :status', { status: 'paid' })
        .orderBy('order.createdAt', 'DESC')
        .addOrderBy('tickets.id', 'ASC')
        .getMany();

      if (!orders || orders.length === 0) {
        return [];
      }

      const now = new Date();

      return orders.map((order) => {
        const firstTicket = order.tickets[0];
        const event = firstTicket?.show?.event;
        const show = firstTicket?.show;
        const banner =
          event?.images?.find((img) => img.imageType === 'banner')?.imageUrl ||
          event?.images?.[0]?.imageUrl ||
          null;

        const showStartTime = show?.startTime ? new Date(show.startTime) : order.createdAt;
        const isPast = showStartTime.getTime() < now.getTime();

        const cityInfo = resolveCityFromUbigeo(event?.ubigeoCode);

        // Formatos legibles para Perú
        const eventDateFormatted = new Intl.DateTimeFormat('es-PE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(showStartTime);

        const eventTimeFormatted = new Intl.DateTimeFormat('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(showStartTime);

        const payment = order.payments?.[0];

        const mappedTickets: UserOrderTicketDto[] = order.tickets.map((t, index) => {
          return plainToInstance(
            UserOrderTicketDto,
            {
              ticketId: t.id,
              ticketUuid: t.publicUuid,
              ticketNumber: index + 1,
              zoneName: t.zone?.name || 'GENERAL',
              tierName: t.pricingTier?.name || t.zone?.name || 'General',
              unitPrice: Number(t.paidBasePrice || 0),
              qrPayload: t.qrCode || `QPH|ORD:${order.id}|TCK:${t.id}|SEC:${t.publicUuid.substring(0, 8)}`,
              status: t.status,
            },
            { excludeExtraneousValues: true },
          );
        });

        return plainToInstance(
          UserOrderResponseDto,
          {
            orderId: order.id,
            orderCode: `#QPH-${String(order.id).padStart(6, '0')}`,
            orderUuid: order.publicUuid,
            orderDate: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
            totalAmount: Number(order.totalAmount || 0),
            status: order.status,
            paymentMethod: payment?.paymentMethod || 'Tarjeta de crédito',
            txCode: payment?.externalTransactionId || `TX-${String(order.id).padStart(6, '0')}`,
            ticketCount: order.tickets.length,
            eventId: event ? String(event.id) : '1',
            eventTitle: event?.name || 'Evento Oficial',
            eventSlug: event?.slug || '',
            hasLandingPage: event?.hasLandingPage || false,
            category: event?.category || 'CONCERTS',
            venueName: event?.venue || 'Recinto Oficial',
            venueAddress: event?.address || 'Ubicación Confirmada, Perú',
            city: cityInfo.name,
            bannerImageUrl: banner,
            eventDateFormatted:
              eventDateFormatted.charAt(0).toUpperCase() + eventDateFormatted.slice(1),
            eventTimeFormatted,
            showStartTimeIso: showStartTime.toISOString(),
            isPast,
            zoneName: firstTicket?.zone?.name || 'GENERAL',
            tickets: mappedTickets,
          },
          { excludeExtraneousValues: true },
        );
      });
    } catch (error: any) {
      this.logger.error(`Error al recuperar compras del usuario ${query.userId}: ${error.message || error}`);
      return [];
    }
  }
}

