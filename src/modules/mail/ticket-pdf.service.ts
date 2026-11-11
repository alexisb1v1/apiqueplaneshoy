import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

export interface TicketPdfEntryInput {
  ticketNumber: number;
  ticketCode: string;
  zoneName: string;
  tierName: string;
  unitPriceFormatted: string;
  qrPayload: string;
}

export interface GenerateTicketsPdfInput {
  orderCode: string;
  txCode: string;
  eventTitle: string;
  eventSubtitle?: string | null;
  eventDateFormatted: string;
  eventTimeFormatted: string;
  emissionDateFormatted?: string | null;
  venueName: string;
  venueAddress?: string | null;
  city: string;
  customerName: string;
  customerEmail: string;
  totalAmountFormatted: string;
  tickets: TicketPdfEntryInput[];
}

const PDF_COLORS = {
  electricIndigo: '#6366F1',
  deepSlate: '#0F172A',
  onSurfaceVariant: '#464554',
  surfaceGray: '#F1F5F9',
  surfaceSoft: '#F8FAFC',
  surfaceVariant: '#CBD5E1',
  outlineVariant: '#C7C4D7',
  subtleBorder: '#E2E8F0',
  white: '#FFFFFF',
} as const;

type VectorIconType =
  | 'shield'
  | 'qrScanner'
  | 'calendar'
  | 'pin'
  | 'clock'
  | 'badge'
  | 'verified'
  | 'gavel';

const DECORATIVE_BARCODE_WIDTHS = [3, 1, 4, 2, 1, 3, 5, 1, 2, 4, 2, 1, 3, 5, 2];

const LEGAL_CONDITIONS: Array<{ number: string; title: string; body: string }> = [
  {
    number: '1.',
    title: 'Control de Identidad:',
    body: 'Presentar DNI, Carné de Extranjería o Pasaporte original en vigor coincidente con los datos del comprador.',
  },
  {
    number: '2.',
    title: 'Validez del Código:',
    body: 'Cada código QR permite un único acceso en puerta. Prohibida su duplicación o reventa no autorizada.',
  },
  {
    number: '3.',
    title: 'Apertura y Puntualidad:',
    body: 'Se recomienda llegar con antelación al inicio de la función para el control de seguridad.',
  },
  {
    number: '4.',
    title: 'Soporte y Reclamaciones:',
    body: 'En caso de incidencias en torno de acceso, acuda a la boletería oficial del evento con su DNI.',
  },
];

@Injectable()
export class TicketPdfService {
  private readonly logger = new Logger(TicketPdfService.name);

  /**
   * Genera un código QR en formato PNG de alta corrección de errores (`H`) como `Buffer`.
   */
  async generateQrPngBuffer(qrPayload: string): Promise<Buffer> {
    return QRCode.toBuffer(qrPayload, {
      type: 'png',
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: PDF_COLORS.deepSlate,
        light: PDF_COLORS.white,
      },
    });
  }

  /**
   * Genera en memoria un documento PDF oficial (una hoja A4 por entrada) replicando el
   * diseño corporativo oficial de `TicketPrintScreen` del frontend.
   */
  async generateTicketsPdfBuffer(
    input: GenerateTicketsPdfInput,
    precomputedQrBuffers?: Map<number, Buffer>,
  ): Promise<Buffer> {
    const qrBuffers = precomputedQrBuffers ?? new Map<number, Buffer>();

    for (let i = 0; i < input.tickets.length; i++) {
      if (!qrBuffers.has(i)) {
        const buffer = await this.generateQrPngBuffer(input.tickets[i].qrPayload);
        qrBuffers.set(i, buffer);
      }
    }

    const emissionDate =
      input.emissionDateFormatted ||
      new Intl.DateTimeFormat('es-PE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Lima',
      }).format(new Date());

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const margin = 34;
        const doc = new PDFDocument({
          size: 'A4',
          margin,
          info: {
            Title: `Entradas ${input.orderCode} - ${input.eventTitle}`,
            Author: 'queplaneshoy',
            Subject: `Pases Oficiales ${input.orderCode}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: Error) => reject(err));

        const contentWidth = doc.page.width - margin * 2; // 527.28pt
        const totalSheets = Math.max(input.tickets.length, 1);

        input.tickets.forEach((ticket, index) => {
          if (index > 0) {
            doc.addPage();
          }

          this.drawSheetMetaBar(doc, margin, contentWidth, index + 1, totalSheets, ticket.ticketCode);
          this.drawInstitutionalHeader(doc, margin, contentWidth, input, emissionDate);
          this.drawSecurityBanner(doc, margin, contentWidth, index + 1, totalSheets);

          const cardTop = 158;
          const cardHeight = this.drawTicketCouponCard(
            doc,
            margin,
            cardTop,
            contentWidth,
            input,
            ticket,
            index,
            totalSheets,
            qrBuffers.get(index),
          );

          const quickRowTop = cardTop + cardHeight + 12;
          const quickRowHeight = this.drawQuickAccessRow(doc, margin, quickRowTop, contentWidth, input);

          const footerTop = quickRowTop + quickRowHeight + 12;
          this.drawLegalConditionsFooter(doc, margin, footerTop, contentWidth);
        });

        doc.end();
      } catch (err) {
        this.logger.error(`Error generando PDF de entradas: ${(err as Error).message}`);
        reject(err);
      }
    });
  }

  /**
   * Dibuja la fila superior de control de hoja (`Hoja X de N • Entrada Oficial` + código de entrada).
   */
  private drawSheetMetaBar(
    doc: PDFKit.PDFDocument,
    x: number,
    width: number,
    ticketNum: number,
    totalSheets: number,
    ticketCode: string,
  ): void {
    const y = 24;
    doc.circle(x + 3.5, y + 6, 2.5).fill(PDF_COLORS.electricIndigo);

    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Hoja ${ticketNum} de ${totalSheets} · Entrada Oficial`, x + 10, y + 2);

    doc.font('Courier').fontSize(7.5);
    const codeTextWidth = Math.max(doc.widthOfString(ticketCode) + 14, 92);
    const pillX = x + width - codeTextWidth;

    doc
      .roundedRect(pillX, y, codeTextWidth, 15, 4)
      .lineWidth(0.7)
      .fillAndStroke(PDF_COLORS.surfaceGray, PDF_COLORS.surfaceVariant);
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .text(ticketCode, pillX, y + 4, { width: codeTextWidth, align: 'center' });

    doc
      .moveTo(x, y + 21)
      .lineTo(x + width, y + 21)
      .lineWidth(0.6)
      .stroke(PDF_COLORS.subtleBorder);
  }

  /**
   * Dibuja la cabecera blanca institucional coincidente con el visor oficial web (`queplaneshoy`).
   */
  private drawInstitutionalHeader(
    doc: PDFKit.PDFDocument,
    x: number,
    width: number,
    input: GenerateTicketsPdfInput,
    emissionDate: string,
  ): void {
    const y = 52;

    // Caja blanca con isotipo QPH
    doc
      .roundedRect(x, y + 2, 36, 36, 9)
      .lineWidth(0.8)
      .fillAndStroke(PDF_COLORS.white, PDF_COLORS.subtleBorder);
    doc.roundedRect(x + 4, y + 6, 28, 28, 7).fill(PDF_COLORS.electricIndigo);
    doc
      .fillColor(PDF_COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text('QPH', x + 4, y + 16, { width: 28, align: 'center' });

    // Marca textual queplaneshoy + subtítulo
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(PDF_COLORS.deepSlate)
      .text('queplanes', x + 44, y + 4, { continued: true })
      .fillColor(PDF_COLORS.electricIndigo)
      .text('hoy');

    doc
      .fillColor(PDF_COLORS.electricIndigo)
      .font('Helvetica-Bold')
      .fontSize(6.8)
      .text('BOLETERÍA OFICIAL · ACCESO DIGITAL GARANTIZADO', x + 44, y + 24);

    // Bloque derecho: badge verificado + pedido + emisión
    const badgeW = 166;
    const badgeH = 16;
    const badgeX = x + width - badgeW;

    doc
      .roundedRect(badgeX, y, badgeW, badgeH, 8)
      .lineWidth(0.75)
      .fillAndStroke(PDF_COLORS.surfaceGray, PDF_COLORS.surfaceVariant);
    this.drawMiniIcon(doc, 'shield', badgeX + 10, y + 3.5, 9, PDF_COLORS.electricIndigo);
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(6.8)
      .text('VERIFICADO · QPH PASS ED25519', badgeX + 21, y + 5, { width: badgeW - 25 });

    const metaW = 260;
    const metaX = x + width - metaW;
    const txSuffix = input.txCode ? ` · Ref: ${input.txCode}` : '';

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PDF_COLORS.deepSlate)
      .text(`Pedido: ${input.orderCode}${txSuffix}`, metaX, y + 21, {
        width: metaW,
        align: 'right',
        ellipsis: true,
        lineBreak: false,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PDF_COLORS.deepSlate)
      .text(`Emisión: ${emissionDate}`, metaX, y + 32, {
        width: metaW,
        align: 'right',
        ellipsis: true,
        lineBreak: false,
      });

    doc
      .moveTo(x, y + 46)
      .lineTo(x + width, y + 46)
      .lineWidth(0.8)
      .stroke(PDF_COLORS.surfaceVariant);
  }

  /**
   * Dibuja el banner gris informativo debajo del encabezado.
   */
  private drawSecurityBanner(
    doc: PDFKit.PDFDocument,
    x: number,
    width: number,
    ticketNum: number,
    totalSheets: number,
  ): void {
    const y = 108;
    const height = 34;

    doc
      .roundedRect(x, y, width, height, 9)
      .lineWidth(0.8)
      .fillAndStroke(PDF_COLORS.surfaceGray, PDF_COLORS.surfaceVariant);

    this.drawMiniIcon(doc, 'qrScanner', x + 12, y + 10, 14, PDF_COLORS.electricIndigo);

    const badgeW = 72;
    const textW = width - 40 - badgeW - 14;
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(
        'Pase digital oficial e intransferible. Muestre el código QR directamente en los tornos o puertas de acceso.',
        x + 34,
        y + 12,
        { width: textW, lineBreak: false, ellipsis: true },
      );

    const badgeX = x + width - badgeW - 10;
    doc
      .roundedRect(badgeX, y + 9, badgeW, 16, 4)
      .lineWidth(0.7)
      .fillAndStroke(PDF_COLORS.white, PDF_COLORS.surfaceVariant);
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica-Bold')
      .fontSize(6.8)
      .text(`ENTRADA ${ticketNum}/${totalSheets}`, badgeX, y + 14, {
        width: badgeW,
        align: 'center',
      });
  }

  /**
   * Dibuja la tarjeta principal estilo cupón recortable con franja índigo, bento grid 2x2 y talón QR.
   */
  private drawTicketCouponCard(
    doc: PDFKit.PDFDocument,
    x: number,
    cardTop: number,
    width: number,
    input: GenerateTicketsPdfInput,
    ticket: TicketPdfEntryInput,
    index: number,
    totalSheets: number,
    qrBuffer?: Buffer,
  ): number {
    const stripeWidth = 9;
    const stubWidth = 152;
    const dividerX = x + width - stubWidth;
    const leftPad = 15;
    const leftX = x + stripeWidth + leftPad;
    const leftW = dividerX - leftX - leftPad;

    const isHolder = index === 0;
    const holderLabel = isHolder ? 'TITULAR NOMINAL' : 'ACOMPAÑANTE';
    const holderValue = isHolder
      ? (input.customerName || 'TITULAR REGISTRADO').toUpperCase()
      : `INVITADO DE ${(input.customerName || 'COMPRADOR').toUpperCase()}`;
    const holderSub = isHolder
      ? `Identificación: ${input.customerEmail}`
      : 'Presentar DNI del acompañante en acceso';

    const rawZone = (ticket.zoneName || ticket.tierName || 'GENERAL')
      .toUpperCase()
      .replace('DIVERCION', 'DIVERSIÓN');
    const eventSubtitle =
      input.eventSubtitle || 'Entrada Oficial Garantizada · Qué Planes Hoy';
    const addressLine = [input.venueAddress, input.city].filter(Boolean).join(', ') || input.city;

    // Medición previa del contenido izquierdo para dimensionar dinámicamente la tarjeta
    doc.font('Helvetica-Bold').fontSize(15);
    const titleH = Math.max(doc.heightOfString(input.eventTitle, { width: leftW, lineGap: 1.5 }), 18);

    const bentoPadX = 12;
    const bentoPadY = 10;
    const colGap = 14;
    const col1W = (leftW - bentoPadX * 2 - colGap) * 0.52;
    const col2W = (leftW - bentoPadX * 2 - colGap) * 0.48;

    doc.font('Helvetica-Bold').fontSize(9.5);
    const holderValH = doc.heightOfString(holderValue, { width: col1W });
    doc.font('Helvetica').fontSize(7.5);
    const holderSubH = doc.heightOfString(holderSub, { width: col1W });
    const row1H = Math.max(11 + holderValH + 2 + holderSubH, 36);

    doc.font('Helvetica-Bold').fontSize(8.5);
    const dateH = doc.heightOfString(input.eventDateFormatted, { width: col1W - 14 });
    const venueH = doc.heightOfString(input.venueName, { width: col2W - 14 });
    doc.font('Helvetica').fontSize(7.5);
    const addrH = doc.heightOfString(addressLine, { width: col2W });
    const row2H = Math.max(11 + dateH + 12, 11 + venueH + 3 + addrH, 36);

    const bentoH = bentoPadY * 2 + row1H + 10 + row2H;

    const topMetaH = 22;
    const subtitleH = 14;
    const bottomBarH = 28;
    const leftTotalH = 16 + topMetaH + titleH + 3 + subtitleH + 10 + bentoH + 10 + bottomBarH + 14;
    const cardHeight = Math.max(leftTotalH, 266);

    // Fondo blanco y borde principal de la tarjeta
    doc
      .roundedRect(x, cardTop, width, cardHeight, 12)
      .lineWidth(1)
      .fillAndStroke(PDF_COLORS.white, PDF_COLORS.surfaceVariant);

    // Franja lateral izquierda índigo recortada al borde redondeado
    doc.save();
    doc.roundedRect(x, cardTop, width, cardHeight, 12).clip();
    doc.rect(x, cardTop, stripeWidth, cardHeight).fill(PDF_COLORS.electricIndigo);
    doc.restore();

    // Fondo sutil del talón derecho recortado
    doc.save();
    doc.roundedRect(x, cardTop, width, cardHeight, 12).clip();
    doc.rect(dividerX, cardTop, stubWidth, cardHeight).fill(PDF_COLORS.surfaceSoft);
    doc.restore();

    // Borde exterior final limpio y línea punteada vertical del talón
    doc
      .roundedRect(x, cardTop, width, cardHeight, 12)
      .lineWidth(1)
      .stroke(PDF_COLORS.surfaceVariant);

    doc
      .save()
      .moveTo(dividerX, cardTop + 10)
      .lineTo(dividerX, cardTop + cardHeight - 10)
      .dash(4, { space: 3 })
      .lineWidth(1.1)
      .stroke(PDF_COLORS.outlineVariant)
      .restore();

    // Muescas circulares superior e inferior sobre la línea de corte
    this.drawTicketNotch(doc, dividerX, cardTop, 'top');
    this.drawTicketNotch(doc, dividerX, cardTop + cardHeight, 'bottom');

    // Fila superior de badges dentro del cuerpo izquierdo
    const badgesY = cardTop + 16;
    doc.font('Helvetica-Bold').fontSize(7.2);
    const zoneBadgeW = Math.min(Math.max(doc.widthOfString(rawZone) + 18, 56), 130);
    doc.roundedRect(leftX, badgesY, zoneBadgeW, 15, 7.5).fill(PDF_COLORS.electricIndigo);
    doc
      .fillColor(PDF_COLORS.white)
      .text(rawZone, leftX + 4, badgesY + 4.5, {
        width: zoneBadgeW - 8,
        align: 'center',
        ellipsis: true,
        lineBreak: false,
      });

    const countBadgeX = leftX + zoneBadgeW + 6;
    const countLabel = `ENTRADA ${index + 1} DE ${totalSheets}`;
    const countBadgeW = Math.max(doc.widthOfString(countLabel) + 14, 72);
    doc
      .roundedRect(countBadgeX, badgesY, countBadgeW, 15, 4)
      .lineWidth(0.7)
      .fillAndStroke(PDF_COLORS.surfaceGray, PDF_COLORS.surfaceVariant);
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .text(countLabel, countBadgeX, badgesY + 4.5, { width: countBadgeW, align: 'center' });

    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text('CONTROL QR · ACCESO OFICIAL', leftX, badgesY + 4.5, {
        width: leftW,
        align: 'right',
      });

    // Título y subtítulo del evento
    const titleY = badgesY + topMetaH;
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(input.eventTitle, leftX, titleY, { width: leftW, lineGap: 1.5 });

    const subtitleY = titleY + titleH + 3;
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica')
      .fontSize(8.5)
      .text(eventSubtitle, leftX, subtitleY, {
        width: leftW,
        lineBreak: false,
        ellipsis: true,
      });

    // Bento Grid 2x2
    const bentoY = subtitleY + subtitleH + 10;
    doc
      .roundedRect(leftX, bentoY, leftW, bentoH, 9)
      .lineWidth(0.8)
      .fillAndStroke(PDF_COLORS.surfaceSoft, PDF_COLORS.surfaceVariant);

    const col1X = leftX + bentoPadX;
    const col2X = col1X + col1W + colGap;
    const r1Y = bentoY + bentoPadY;

    // Celda (1,1): Titular Nominal
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text(holderLabel, col1X, r1Y);
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(holderValue, col1X, r1Y + 10, { width: col1W });
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica')
      .fontSize(7.5)
      .text(holderSub, col1X, r1Y + 10 + holderValH + 2, { width: col1W });

    // Celda (1,2): Zona & Localidad
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('ZONA & LOCALIDAD', col2X, r1Y);
    doc
      .fillColor(PDF_COLORS.electricIndigo)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(ticket.zoneName || rawZone, col2X, r1Y + 10, {
        width: col2W,
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica')
      .fontSize(7.5)
      .text('Acceso garantizado · Control digital', col2X, r1Y + 23, { width: col2W });

    // Celda (2,1): Fecha y Horario
    const r2Y = r1Y + row1H + 10;
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('FECHA Y HORARIO', col1X, r2Y);
    this.drawMiniIcon(doc, 'calendar', col1X, r2Y + 10, 9.5, PDF_COLORS.electricIndigo);
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(input.eventDateFormatted, col1X + 13, r2Y + 10.5, { width: col1W - 14 });
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`Función programada: ${input.eventTimeFormatted}`, col1X, r2Y + 10.5 + dateH + 2, {
        width: col1W,
      });

    // Celda (2,2): Recinto & Dirección
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('RECINTO & DIRECCIÓN', col2X, r2Y);
    this.drawMiniIcon(doc, 'pin', col2X, r2Y + 10, 9.5, PDF_COLORS.electricIndigo);
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(input.venueName, col2X + 13, r2Y + 10.5, {
        width: col2W - 14,
        ellipsis: true,
      });
    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica')
      .fontSize(7.5)
      .text(addressLine, col2X, r2Y + 10.5 + venueH + 2, { width: col2W });

    // Pie de tarjeta: Precio Oficial y Total Orden
    const footerLineY = bentoY + bentoH + 11;
    doc
      .moveTo(leftX, footerLineY)
      .lineTo(leftX + leftW, footerLineY)
      .lineWidth(0.7)
      .stroke(PDF_COLORS.surfaceVariant);

    const priceY = footerLineY + 9;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .text('Precio Oficial: ', leftX, priceY, { continued: true })
      .font('Helvetica-Bold')
      .fillColor(PDF_COLORS.deepSlate)
      .text(ticket.unitPriceFormatted, { continued: true })
      .font('Helvetica')
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .text(' (Servicio e impuestos incluidos)');

    const totalPrefix = 'Total Orden: ';
    doc.font('Helvetica-Bold').fontSize(8.5);
    const totalPrefixW = doc.widthOfString(totalPrefix);
    doc.font('Helvetica-Bold').fontSize(10);
    const totalAmountW = doc.widthOfString(input.totalAmountFormatted);
    const totalStartX = leftX + leftW - totalPrefixW - totalAmountW;

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(PDF_COLORS.deepSlate)
      .text(totalPrefix, totalStartX, priceY, { continued: true })
      .fontSize(10)
      .fillColor(PDF_COLORS.electricIndigo)
      .text(input.totalAmountFormatted);

    // Talón derecho: E-TICKET SEGURO + QR con logo QPH central + código + barcode decorativo
    this.drawTicketStub(doc, dividerX, cardTop, stubWidth, cardHeight, input.orderCode, ticket.ticketCode, qrBuffer);

    return cardHeight;
  }

  /**
   * Dibuja una muesca semicircular de corte sobre la línea divisoria del cupón.
   */
  private drawTicketNotch(
    doc: PDFKit.PDFDocument,
    centerX: number,
    edgeY: number,
    position: 'top' | 'bottom',
  ): void {
    const radius = 6.5;
    const clipY = position === 'top' ? edgeY - 0.5 : edgeY - radius - 1;
    const clipH = radius + 1.5;

    doc.save();
    doc.rect(centerX - radius - 2, clipY, (radius + 2) * 2, clipH).clip();
    doc
      .circle(centerX, edgeY, radius)
      .lineWidth(0.9)
      .fillAndStroke(PDF_COLORS.white, PDF_COLORS.surfaceVariant);
    doc.restore();

    // Limpiar el trazo horizontal exacto sobre la abertura del borde
    const eraseY = position === 'top' ? edgeY - 1.2 : edgeY - 0.6;
    doc.rect(centerX - radius + 0.8, eraseY, (radius - 0.8) * 2, 1.8).fill(PDF_COLORS.white);
  }

  /**
   * Dibuja el talón derecho del boleto con el código QR de alta redundancia y logo QPH central.
   */
  private drawTicketStub(
    doc: PDFKit.PDFDocument,
    stubX: number,
    cardTop: number,
    stubWidth: number,
    cardHeight: number,
    orderCode: string,
    ticketCode: string,
    qrBuffer?: Buffer,
  ): void {
    const innerStubH = 224;
    const startY = cardTop + Math.max((cardHeight - innerStubH) / 2, 14);

    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text('E-TICKET SEGURO', stubX + 8, startY, {
        width: stubWidth - 16,
        align: 'center',
      });

    const qrBoxSize = 118;
    const qrSize = 108;
    const qrBoxX = stubX + (stubWidth - qrBoxSize) / 2;
    const qrBoxY = startY + 14;
    const qrX = qrBoxX + (qrBoxSize - qrSize) / 2;
    const qrY = qrBoxY + (qrBoxSize - qrSize) / 2;

    doc
      .roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 9)
      .lineWidth(0.8)
      .fillAndStroke(PDF_COLORS.white, PDF_COLORS.surfaceVariant);

    if (qrBuffer) {
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // Badge central QPH seguro (< 6% de superficie sobre QR con corrección nivel H = 30%)
      const logoOuter = 24;
      const logoInner = 19;
      const cx = qrX + qrSize / 2;
      const cy = qrY + qrSize / 2;

      doc.roundedRect(cx - logoOuter / 2, cy - logoOuter / 2, logoOuter, logoOuter, 5).fill(PDF_COLORS.white);
      doc
        .roundedRect(cx - logoInner / 2, cy - logoInner / 2, logoInner, logoInner, 4)
        .fill(PDF_COLORS.electricIndigo);
      doc
        .fillColor(PDF_COLORS.white)
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .text('QPH', cx - logoInner / 2, cy - 2.6, { width: logoInner, align: 'center' });
    }

    const codeY = qrBoxY + qrBoxSize + 10;
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Courier-Bold')
      .fontSize(8.5)
      .text(ticketCode, stubX + 8, codeY, { width: stubWidth - 16, align: 'center' });

    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Courier')
      .fontSize(7)
      .text(`REF: ${orderCode}`, stubX + 8, codeY + 12, {
        width: stubWidth - 16,
        align: 'center',
        ellipsis: true,
        lineBreak: false,
      });

    // Código de barras decorativo
    const barcodeY = codeY + 26;
    const barGap = 2;
    const totalBarsW =
      DECORATIVE_BARCODE_WIDTHS.reduce((sum, w) => sum + w, 0) +
      (DECORATIVE_BARCODE_WIDTHS.length - 1) * barGap;
    let barCursorX = stubX + (stubWidth - totalBarsW) / 2;
    for (const barW of DECORATIVE_BARCODE_WIDTHS) {
      doc.rect(barCursorX, barcodeY, barW, 12).fill(PDF_COLORS.deepSlate);
      barCursorX += barW + barGap;
    }

    doc
      .fillColor(PDF_COLORS.onSurfaceVariant)
      .font('Helvetica')
      .fontSize(7)
      .text('Acceso nominal 1 persona', stubX + 8, barcodeY + 17, {
        width: stubWidth - 16,
        align: 'center',
      });
  }

  /**
   * Dibuja la fila de 4 tarjetas de instrucciones rápidas debajo del cupón.
   */
  private drawQuickAccessRow(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    input: GenerateTicketsPdfInput,
  ): number {
    const gap = 8;
    const cardW = (width - gap * 3) / 4;
    const cardH = 38;

    const cards: Array<{ icon: VectorIconType; label: string; value: string }> = [
      { icon: 'clock', label: 'HORARIO', value: input.eventTimeFormatted },
      { icon: 'badge', label: 'IDENTIDAD', value: 'DNI requerido' },
      { icon: 'pin', label: 'RECINTO', value: input.venueName },
      { icon: 'verified', label: 'TORNOS QR', value: 'Pase directo' },
    ];

    cards.forEach((card, idx) => {
      const cardX = x + idx * (cardW + gap);
      doc
        .roundedRect(cardX, y, cardW, cardH, 9)
        .lineWidth(0.8)
        .fillAndStroke(PDF_COLORS.surfaceSoft, PDF_COLORS.surfaceVariant);

      this.drawMiniIcon(doc, card.icon, cardX + 9, y + 12, 13, PDF_COLORS.electricIndigo);

      const textX = cardX + 27;
      const textW = cardW - 33;
      doc
        .fillColor(PDF_COLORS.onSurfaceVariant)
        .font('Helvetica-Bold')
        .fontSize(6.2)
        .text(card.label, textX, y + 10, { width: textW, lineBreak: false });
      doc
        .fillColor(PDF_COLORS.deepSlate)
        .font('Helvetica-Bold')
        .fontSize(7.8)
        .text(card.value, textX, y + 20, { width: textW, lineBreak: false, ellipsis: true });
    });

    return cardH;
  }

  /**
   * Dibuja el pie legal de 2 columnas con las 4 condiciones de uso oficiales.
   */
  private drawLegalConditionsFooter(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
  ): void {
    const padX = 14;
    const padY = 12;
    const colGap = 16;
    const colW = (width - padX * 2 - colGap) / 2;

    doc.font('Helvetica').fontSize(7.5);
    const leftTopH = doc.heightOfString(
      `${LEGAL_CONDITIONS[0].title} ${LEGAL_CONDITIONS[0].body}`,
      { width: colW - 14, lineGap: 1.5 },
    );
    const rightTopH = doc.heightOfString(
      `${LEGAL_CONDITIONS[1].title} ${LEGAL_CONDITIONS[1].body}`,
      { width: colW - 14, lineGap: 1.5 },
    );
    const leftBotH = doc.heightOfString(
      `${LEGAL_CONDITIONS[2].title} ${LEGAL_CONDITIONS[2].body}`,
      { width: colW - 14, lineGap: 1.5 },
    );
    const rightBotH = doc.heightOfString(
      `${LEGAL_CONDITIONS[3].title} ${LEGAL_CONDITIONS[3].body}`,
      { width: colW - 14, lineGap: 1.5 },
    );

    const row1H = Math.max(leftTopH, rightTopH);
    const row2H = Math.max(leftBotH, rightBotH);
    const footerH = padY * 2 + 20 + row1H + 8 + row2H;

    doc
      .roundedRect(x, y, width, footerH, 9)
      .lineWidth(0.8)
      .fillAndStroke(PDF_COLORS.surfaceSoft, PDF_COLORS.surfaceVariant);

    this.drawMiniIcon(doc, 'gavel', x + padX, y + padY, 11, PDF_COLORS.electricIndigo);
    doc
      .fillColor(PDF_COLORS.deepSlate)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('CONDICIONES DE USO Y NORMATIVA OFICIAL DE ACCESO', x + padX + 16, y + padY + 2);

    const gridTop = y + padY + 20;

    LEGAL_CONDITIONS.forEach((item, idx) => {
      const colIndex = idx % 2;
      const rowIndex = Math.floor(idx / 2);
      const cellX = x + padX + colIndex * (colW + colGap);
      const cellY = gridTop + (rowIndex === 0 ? 0 : row1H + 8);

      doc
        .fillColor(PDF_COLORS.deepSlate)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(item.number, cellX, cellY);

      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(PDF_COLORS.deepSlate)
        .text(`${item.title} `, cellX + 12, cellY, {
          width: colW - 12,
          lineGap: 1.5,
          continued: true,
        })
        .font('Helvetica')
        .fillColor(PDF_COLORS.onSurfaceVariant)
        .text(item.body, { width: colW - 12, lineGap: 1.5 });
    });
  }

  /**
   * Dibuja iconos vectoriales simples independientes de fuentes externas (compatibles 100% con Alpine/PDFKit).
   */
  private drawMiniIcon(
    doc: PDFKit.PDFDocument,
    type: VectorIconType,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    doc.save();
    doc.strokeColor(color).fillColor(color).lineWidth(1.1);

    switch (type) {
      case 'shield': {
        const cx = x + size / 2;
        doc
          .moveTo(cx, y)
          .lineTo(x + size * 0.9, y + size * 0.22)
          .lineTo(x + size * 0.85, y + size * 0.65)
          .lineTo(cx, y + size)
          .lineTo(x + size * 0.15, y + size * 0.65)
          .lineTo(x + size * 0.1, y + size * 0.22)
          .closePath()
          .fill(color);
        doc
          .strokeColor(PDF_COLORS.white)
          .lineWidth(1.2)
          .moveTo(x + size * 0.3, y + size * 0.52)
          .lineTo(x + size * 0.45, y + size * 0.68)
          .lineTo(x + size * 0.72, y + size * 0.36)
          .stroke();
        break;
      }
      case 'qrScanner': {
        const c = size * 0.28;
        // Cuatro esquinas del visor
        doc
          .moveTo(x, y + c).lineTo(x, y).lineTo(x + c, y)
          .moveTo(x + size - c, y).lineTo(x + size, y).lineTo(x + size, y + c)
          .moveTo(x, y + size - c).lineTo(x, y + size).lineTo(x + c, y + size)
          .moveTo(x + size - c, y + size).lineTo(x + size, y + size).lineTo(x + size, y + size - c)
          .stroke();
        doc.rect(x + size * 0.26, y + size * 0.26, size * 0.18, size * 0.18).fill(color);
        doc.rect(x + size * 0.56, y + size * 0.26, size * 0.18, size * 0.18).fill(color);
        doc.rect(x + size * 0.26, y + size * 0.56, size * 0.18, size * 0.18).fill(color);
        doc.rect(x + size * 0.56, y + size * 0.56, size * 0.18, size * 0.18).fill(color);
        break;
      }
      case 'calendar': {
        doc.roundedRect(x, y + size * 0.15, size, size * 0.85, 1.5).stroke();
        doc
          .moveTo(x + size * 0.28, y).lineTo(x + size * 0.28, y + size * 0.24)
          .moveTo(x + size * 0.72, y).lineTo(x + size * 0.72, y + size * 0.24)
          .moveTo(x, y + size * 0.42).lineTo(x + size, y + size * 0.42)
          .stroke();
        break;
      }
      case 'pin': {
        const cx = x + size / 2;
        doc.circle(cx, y + size * 0.36, size * 0.3).stroke();
        doc.circle(cx, y + size * 0.36, size * 0.09).fill(color);
        doc
          .moveTo(cx - size * 0.24, y + size * 0.55)
          .lineTo(cx, y + size)
          .lineTo(cx + size * 0.24, y + size * 0.55)
          .stroke();
        break;
      }
      case 'clock': {
        const cx = x + size / 2;
        const cy = y + size / 2;
        doc.circle(cx, cy, size * 0.45).stroke();
        doc.moveTo(cx, cy - size * 0.24).lineTo(cx, cy).lineTo(cx + size * 0.2, cy + size * 0.1).stroke();
        break;
      }
      case 'badge': {
        doc.roundedRect(x, y + size * 0.15, size, size * 0.7, 1.8).stroke();
        doc.circle(x + size * 0.32, y + size * 0.46, size * 0.13).fill(color);
        doc
          .moveTo(x + size * 0.56, y + size * 0.38).lineTo(x + size * 0.84, y + size * 0.38)
          .moveTo(x + size * 0.56, y + size * 0.58).lineTo(x + size * 0.78, y + size * 0.58)
          .stroke();
        break;
      }
      case 'verified': {
        const cx = x + size / 2;
        const cy = y + size / 2;
        doc.circle(cx, cy, size * 0.45).stroke();
        doc
          .moveTo(x + size * 0.28, cy)
          .lineTo(x + size * 0.44, y + size * 0.66)
          .lineTo(x + size * 0.74, y + size * 0.34)
          .stroke();
        break;
      }
      case 'gavel': {
        doc
          .moveTo(x + size * 0.2, y + size * 0.45)
          .lineTo(x + size * 0.55, y + size * 0.1)
          .lineTo(x + size * 0.78, y + size * 0.33)
          .lineTo(x + size * 0.43, y + size * 0.68)
          .closePath()
          .fill(color);
        doc
          .lineWidth(1.5)
          .moveTo(x + size * 0.58, y + size * 0.52)
          .lineTo(x + size * 0.92, y + size * 0.86)
          .stroke();
        doc
          .lineWidth(1.3)
          .moveTo(x + size * 0.08, y + size * 0.88)
          .lineTo(x + size * 0.52, y + size * 0.88)
          .stroke();
        break;
      }
    }

    doc.restore();
  }
}
