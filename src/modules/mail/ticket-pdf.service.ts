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
  eventDateFormatted: string;
  eventTimeFormatted: string;
  venueName: string;
  venueAddress?: string | null;
  city: string;
  customerName: string;
  customerEmail: string;
  totalAmountFormatted: string;
  tickets: TicketPdfEntryInput[];
}

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
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });
  }

  /**
   * Genera en memoria un documento PDF oficial (una hoja A4 por entrada) con los datos del evento
   * y los códigos QR escaneables de cada boleto para adjuntarlo en el correo de confirmación.
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

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 36,
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

        const pageWidth = doc.page.width - 72; // 595.28 - 72 = 523.28

        input.tickets.forEach((ticket, index) => {
          if (index > 0) {
            doc.addPage();
          }

          // Cabecera corporativa superior
          doc.roundedRect(36, 36, pageWidth, 64, 12).fill('#0F172A');

          doc.roundedRect(52, 52, 42, 32, 7).fill('#4F46E5');
          doc
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .fontSize(13)
            .text('QPH', 52, 62, { width: 42, align: 'center' });

          doc
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .fontSize(16)
            .text('queplaneshoy', 104, 52);
          doc
            .fillColor('#CBD5E1')
            .font('Helvetica')
            .fontSize(9)
            .text('BOLETERÍA OFICIAL · PASE DIGITAL VERIFICABLE', 104, 72);

          doc
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .fontSize(11)
            .text(input.orderCode, 36, 54, { width: pageWidth - 18, align: 'right' });
          doc
            .fillColor('#A5B4FC')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(`ENTRADA ${index + 1} DE ${input.tickets.length}`, 36, 72, {
              width: pageWidth - 18,
              align: 'right',
            });

          // Tarjeta principal del boleto
          const cardTop = 118;
          const cardHeight = 320;
          const stubWidth = 188;
          const leftColWidth = pageWidth - stubWidth;

          doc
            .roundedRect(36, cardTop, pageWidth, cardHeight, 14)
            .lineWidth(1.2)
            .fillAndStroke('#FFFFFF', '#CBD5E1');

          // Fondo sutil del talón QR derecho
          doc.save();
          doc.roundedRect(36 + leftColWidth, cardTop, stubWidth, cardHeight, 14).clip();
          doc.rect(36 + leftColWidth, cardTop, stubWidth, cardHeight).fill('#F8FAFC');
          doc.restore();

          // Línea punteada divisoria
          doc
            .save()
            .moveTo(36 + leftColWidth, cardTop + 14)
            .lineTo(36 + leftColWidth, cardTop + cardHeight - 14)
            .dash(5, { space: 4 })
            .lineWidth(1.2)
            .stroke('#94A3B8')
            .restore();

          // Contenido izquierdo: datos del evento, zona y titular
          const leftX = 56;
          const contentW = leftColWidth - 36;

          doc.roundedRect(leftX, cardTop + 22, 130, 20, 10).fill('#EEF2FF');
          doc
            .fillColor('#4F46E5')
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .text('PASE VÁLIDO · 1 INGRESO', leftX, cardTop + 28, {
              width: 130,
              align: 'center',
            });

          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(17)
            .text(input.eventTitle, leftX, cardTop + 54, {
              width: contentW,
              lineGap: 2,
            });

          const afterTitleY = Math.max(doc.y + 10, cardTop + 114);

          doc
            .fillColor('#64748B')
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .text('FECHA Y HORA', leftX, afterTitleY);
          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(11)
            .text(`${input.eventDateFormatted} · ${input.eventTimeFormatted}`, leftX, afterTitleY + 12, {
              width: contentW,
            });

          const afterDateY = doc.y + 10;
          doc
            .fillColor('#64748B')
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .text('RECINTO Y CIUDAD', leftX, afterDateY);
          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(10.5)
            .text(`${input.venueName} — ${input.city}`, leftX, afterDateY + 12, {
              width: contentW,
            });
          if (input.venueAddress) {
            doc
              .fillColor('#475569')
              .font('Helvetica')
              .fontSize(9)
              .text(input.venueAddress, leftX, doc.y + 2, { width: contentW });
          }

          const bottomRowY = cardTop + cardHeight - 74;
          doc
            .moveTo(leftX, bottomRowY - 10)
            .lineTo(leftX + contentW, bottomRowY - 10)
            .lineWidth(0.75)
            .stroke('#E2E8F0');

          doc
            .fillColor('#64748B')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text('ZONA / TARIFA', leftX, bottomRowY);
          doc
            .fillColor('#4F46E5')
            .font('Helvetica-Bold')
            .fontSize(11.5)
            .text(`${ticket.zoneName} (${ticket.tierName})`, leftX, bottomRowY + 11, {
              width: contentW * 0.65,
            });

          doc
            .fillColor('#64748B')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text('PRECIO', leftX + contentW * 0.68, bottomRowY, {
              width: contentW * 0.32,
              align: 'right',
            });
          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(11.5)
            .text(ticket.unitPriceFormatted, leftX + contentW * 0.68, bottomRowY + 11, {
              width: contentW * 0.32,
              align: 'right',
            });

          doc
            .fillColor('#64748B')
            .font('Helvetica')
            .fontSize(8.5)
            .text(
              `Titular: ${input.customerName} (${input.customerEmail})`,
              leftX,
              bottomRowY + 34,
              { width: contentW },
            );

          // Talón derecho: QR Oficial + Código
          const stubX = 36 + leftColWidth;
          const qrSize = 138;
          const qrX = stubX + (stubWidth - qrSize) / 2;
          const qrY = cardTop + 34;

          doc
            .fillColor('#475569')
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .text('ESCANEAR EN PUERTA', stubX + 12, cardTop + 18, {
              width: stubWidth - 24,
              align: 'center',
            });

          const qrBuffer = qrBuffers.get(index);
          if (qrBuffer) {
            doc
              .roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 10)
              .lineWidth(1)
              .fillAndStroke('#FFFFFF', '#E2E8F0');
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
          }

          doc
            .fillColor('#0F172A')
            .font('Courier-Bold')
            .fontSize(9.5)
            .text(ticket.ticketCode, stubX + 10, qrY + qrSize + 18, {
              width: stubWidth - 20,
              align: 'center',
            });

          doc
            .fillColor('#64748B')
            .font('Helvetica')
            .fontSize(7.5)
            .text(`Ref: ${input.txCode}`, stubX + 10, qrY + qrSize + 36, {
              width: stubWidth - 20,
              align: 'center',
            });

          doc
            .fillColor('#4F46E5')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text('Código QR único e intransferible', stubX + 10, qrY + qrSize + 54, {
              width: stubWidth - 20,
              align: 'center',
            });

          // Notas informativas inferiores
          const notesTop = cardTop + cardHeight + 24;
          doc.roundedRect(36, notesTop, pageWidth, 88, 10).fill('#F8FAFC');
          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .text('Indicaciones importantes para tu ingreso:', 52, notesTop + 14);
          doc
            .fillColor('#475569')
            .font('Helvetica')
            .fontSize(8.5)
            .text(
              '1. Presenta este pase en la pantalla de tu celular o impreso en formato A4 legible al llegar al control de acceso.',
              52,
              notesTop + 32,
              { width: pageWidth - 32 },
            )
            .text(
              '2. Cada código QR admite un único ingreso verificado en puerta; no compartas capturas ni copias con terceros.',
              52,
              notesTop + 47,
              { width: pageWidth - 32 },
            )
            .text(
              `3. Total consolidado de la orden ${input.orderCode}: ${input.totalAmountFormatted}. Soporte: soporte@queplaneshoy.com`,
              52,
              notesTop + 62,
              { width: pageWidth - 32 },
            );
        });

        doc.end();
      } catch (err) {
        this.logger.error(`Error generando PDF de entradas: ${(err as Error).message}`);
        reject(err);
      }
    });
  }
}

