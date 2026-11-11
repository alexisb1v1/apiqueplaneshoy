import { TicketPdfService } from './ticket-pdf.service';

describe('TicketPdfService', () => {
  let service: TicketPdfService;

  beforeEach(() => {
    service = new TicketPdfService();
  });

  function countPdfPages(buffer: Buffer): number {
    const latin1 = buffer.toString('latin1');
    const matches = latin1.match(/\/Type\s*\/Page\b(?!s)/g);
    return matches ? matches.length : 0;
  }

  it('debe generar un PDF válido de exactamente 1 página para 1 entrada', async () => {
    const pdfBuffer = await service.generateTicketsPdfBuffer({
      orderCode: '#QPH-000040',
      txCode: 'chr_test_qocjuy02qmnYDIYC',
      eventTitle: 'Armonía 10 - La Primerísima en Vivo #60',
      eventSubtitle: 'CONCERTS · Venta Oficial',
      eventDateFormatted: 'Viernes, 20 de noviembre',
      eventTimeFormatted: '07:00 p. m.',
      emissionDateFormatted: '11 de noviembre de 2026 a las 10:52 a. m.',
      venueName: 'Estadio Aliardo Soria Pérez',
      venueAddress: 'Jr. Inmaculada 450, Pucallpa',
      city: 'Pucallpa',
      customerName: 'ALEXIS FERNANDO BASILIO VERASTEGUI',
      customerEmail: 'alexisb1v1@gmail.com',
      totalAmountFormatted: 'S/. 30.00',
      tickets: [
        {
          ticketNumber: 1,
          ticketCode: 'QPH-TCK-B3F4B577',
          zoneName: 'GENERAL',
          tierName: 'Preventa Promocional',
          unitPriceFormatted: 'S/. 30.00',
          qrPayload: 'QPH-V1:QPH-TCK-B3F4B577:SIGNATURE_TEST_1',
        },
      ],
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(countPdfPages(pdfBuffer)).toBe(1);
  });

  it('debe generar exactamente 1 página por entrada para múltiples boletos (titular + acompañante) con títulos largos sin desborde vertical', async () => {
    const pdfBuffer = await service.generateTicketsPdfBuffer({
      orderCode: '#QPH-000125',
      txCode: 'chr_live_long_tx_reference_9876543210',
      eventTitle:
        'Festival Internacional de Música Andina, Fusión Amazónica y Gran Concierto Sinfónico Edición Especial Bicentenario',
      eventSubtitle: 'FESTIVALS · Venta Oficial',
      eventDateFormatted: 'Sábado, 12 de diciembre de 2026',
      eventTimeFormatted: '08:30 p. m.',
      emissionDateFormatted: '11 de noviembre de 2026 a las 11:15 a. m.',
      venueName: 'Gran Teatro Nacional del Perú y Explanada Cultural Principal de Lima',
      venueAddress: 'Av. Javier Prado Este 2225, San Borja, Referencia Estación La Cultura',
      city: 'Lima',
      customerName: 'ALEXIS FERNANDO BASILIO VERASTEGUI',
      customerEmail: 'alexis.basilio.corporativo.largo@queplaneshoy.com',
      totalAmountFormatted: 'S/. 460.00',
      tickets: [
        {
          ticketNumber: 1,
          ticketCode: 'QPH-TCK-1111AAAA',
          zoneName: 'PLATINUM BOX VIP',
          tierName: 'Preventa Exclusiva',
          unitPriceFormatted: 'S/. 230.00',
          qrPayload: 'QPH-V1:QPH-TCK-1111AAAA:SIGNATURE_TEST_A',
        },
        {
          ticketNumber: 2,
          ticketCode: 'QPH-TCK-2222BBBB',
          zoneName: 'PLATINUM BOX VIP',
          tierName: 'Preventa Exclusiva',
          unitPriceFormatted: 'S/. 230.00',
          qrPayload: 'QPH-V1:QPH-TCK-2222BBBB:SIGNATURE_TEST_B',
        },
      ],
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(countPdfPages(pdfBuffer)).toBe(2);
  });
});

