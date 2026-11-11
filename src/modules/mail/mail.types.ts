export interface EmailAttachment {
  /** Nombre visible del archivo adjunto (ej. entradas-qph.pdf) */
  filename: string;
  /** Contenido codificado en Base64 (sin prefijo data URI) */
  content: string;
  /** Tipo MIME opcional (ej. application/pdf) */
  contentType?: string;
}

export interface EmailTag {
  name: string;
  value: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: EmailTag[];
  attachments?: EmailAttachment[];
}

export interface EmailDeliveryResult {
  ok: boolean;
  mode: 'resend' | 'console' | 'error';
  messageId?: string;
  errorMessage?: string;
}

export interface OrderTicketEmailItem {
  ticketCode: string;
  zoneName: string;
  tierName: string;
  unitPriceFormatted: string;
}

export interface SendOrderTicketsEmailPayload {
  to: string;
  customerName: string;
  orderCode: string;
  eventTitle: string;
  eventDateFormatted: string;
  eventTimeFormatted: string;
  venueName: string;
  city: string;
  totalAmountFormatted: string;
  couponCode?: string | null;
  discountAmountFormatted?: string | null;
  tickets: OrderTicketEmailItem[];
  ticketsPortalUrl?: string;
}

