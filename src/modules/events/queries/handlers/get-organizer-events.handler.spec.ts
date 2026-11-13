import { DataSource } from 'typeorm';
import { GetOrganizerEventsHandler } from './get-organizer-events.handler';
import { GetOrganizerEventsQuery } from '../impl/get-organizer-events.query';

describe('GetOrganizerEventsHandler', () => {
  const userUuid = '11111111-2222-3333-4444-555555555555';
  const eventUuid = 'b3f4b577-12ab-4cde-9012-abcdef123456';

  function createMockQueryBuilder(rows: unknown[]) {
    const qb: Record<string, jest.Mock> = {
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      groupBy: jest.fn(),
      addGroupBy: jest.fn(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    Object.values(qb).forEach((fn) => {
      if (fn !== qb.getRawMany) {
        fn.mockReturnValue(qb);
      }
    });
    return qb;
  }

  it('debe retornar err UNAUTHORIZED si el usuario del token no existe', async () => {
    const eventRepo = { find: jest.fn() } as any;
    const userRepo = { findOne: jest.fn().mockResolvedValue(null) } as any;
    const dataSource = { createQueryBuilder: jest.fn() } as unknown as DataSource;

    const handler = new GetOrganizerEventsHandler(eventRepo, userRepo, dataSource);
    const result = await handler.execute(new GetOrganizerEventsQuery(userUuid));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe('UNAUTHORIZED');
    }
    expect(eventRepo.find).not.toHaveBeenCalled();
  });

  it('debe calcular eventCode desde publicUuid, precios de preventa, descuentos deduplicados y estados reales', async () => {
    const futureDate = new Date(Date.now() + 7 * 86400 * 1000);
    const userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 9, publicUuid: userUuid, isOrganizer: true }),
    } as any;

    const eventRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: '42',
          publicUuid: eventUuid,
          slug: 'armonia-10-en-vivo',
          name: 'Armonía 10 en Vivo',
          category: 'CONCERTS',
          status: 'published',
          hasLandingPage: true,
          ubigeoCode: '250101',
          venue: 'Estadio Aliardo Soria',
          address: 'Jr. Inmaculada 450',
          createdAt: new Date('2026-11-01T10:00:00.000Z'),
          images: [{ imageType: 'banner', imageUrl: 'https://cdn.example.com/banner.webp' }],
          shows: [{ id: '1', startTime: futureDate }],
          settlement: null,
          advances: [{ id: '1' }],
          zones: [
            {
              id: '10',
              publicUuid: 'aaaa1111-0000-0000-0000-000000000010',
              name: 'VIP',
              title: 'Zona VIP',
              color: '#F59E0B',
              capacity: 100,
              soldCount: 85,
              lockedCount: 0,
              regularPrice: 150,
              pricingTiers: [
                {
                  tierNumber: 1,
                  name: 'Preventa 1',
                  price: 100,
                  capacity: 90,
                  soldCount: 85,
                  isActive: true,
                  endAt: futureDate,
                },
              ],
            },
          ],
        },
        {
          id: '43',
          publicUuid: 'c7778888-12ab-4cde-9012-abcdef123456',
          slug: 'evento-finalizado',
          name: 'Concierto Pasado',
          category: 'FESTIVALS',
          status: 'completed',
          hasLandingPage: false,
          ubigeoCode: '150101',
          venue: 'Costa 21',
          address: 'San Miguel',
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
          images: [],
          shows: [{ id: '2', startTime: new Date('2026-10-15T20:00:00.000Z') }],
          settlement: { status: 'in_review' },
          advances: [],
          zones: [
            {
              id: '11',
              publicUuid: 'bbbb1111-0000-0000-0000-000000000011',
              name: 'GENERAL',
              title: null,
              color: '#6366F1',
              capacity: 50,
              soldCount: 50,
              lockedCount: 0,
              regularPrice: 60,
              pricingTiers: [],
            },
          ],
        },
      ]),
    } as any;

    const zoneSalesQb = createMockQueryBuilder([
      { eventId: '42', zoneId: '10', soldCount: '85', grossRevenue: '8500.00' },
      { eventId: '43', zoneId: '11', soldCount: '50', grossRevenue: '3000.00' },
    ]);

    const orderDiscountsQb = createMockQueryBuilder([
      // Simula fila duplicada si un join devolviera el mismo orderId: solo debe restarse 1 vez
      { orderId: '900', eventId: '42', discountAmount: '150.00' },
      { orderId: '900', eventId: '42', discountAmount: '150.00' },
    ]);

    const dataSource = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(zoneSalesQb)
        .mockReturnValueOnce(orderDiscountsQb),
    } as unknown as DataSource;

    const handler = new GetOrganizerEventsHandler(eventRepo, userRepo, dataSource);
    const result = await handler.execute(new GetOrganizerEventsQuery(userUuid));

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(2);

      const first = result.value[0];
      expect(first.eventCode).toBe('#EV-B3F4B577');
      expect(first.statusLabel).toBe('En Venta · Preventa 1');
      expect(first.grossRevenue).toBe(8500);
      expect(first.couponsDiscountAmount).toBe(150);
      expect(first.netSalesRevenue).toBe(8350);
      expect(first.targetRevenue).toBe(15000);
      expect(first.zones[0].activePrice).toBe(100);
      expect(first.zones[0].statusBadge).toBe('Casi agotado');

      const second = result.value[1];
      expect(second.eventCode).toBe('#EV-C7778888');
      expect(second.statusLabel).toBe('Finalizado');
      expect(second.settlementStatus).toBe('in_review');
    }
  });
});

