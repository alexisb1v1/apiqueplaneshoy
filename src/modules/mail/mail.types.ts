export interface EmailAttachment {
  /** Nombre visible del archivo adjunto (ej. entradas-qph.pdf) */
  filename: string;
  /** Contenido codificado en Base64 (sin prefijo data URI) */
  content: string;
  /** Tipo MIME opcional (ej. application/pdf) */
  contentType?: string;
  /** Content-ID opcional para embeber imágenes inline en HTML con `cid:<contentId>` */
  contentId?: string;
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
  /** Payload criptográfico real para generar QR inline/PDF */
  qrPayload?: string;
  /** Content-ID del QR embebido si se adjunta como imagen inline */
  qrImageCid?: string;
}

export interface SendOrderTicketsEmailPayload {
  to: string;
  customerName: string;
  orderCode: string;
  txCode?: string;
  eventTitle: string;
  eventSubtitle?: string | null;
  eventDateFormatted: string;
  eventTimeFormatted: string;
  emissionDateFormatted?: string | null;
  venueName: string;
  venueAddress?: string | null;
  city: string;
  totalAmountFormatted: string;
  couponCode?: string | null;
  discountAmountFormatted?: string | null;
  tickets: OrderTicketEmailItem[];
  ticketsPortalUrl?: string;
  attachments?: EmailAttachment[];
}

export interface SendWelcomeGoogleEmailPayload {
  to: string;
  name: string;
  exploreUrl?: string;
}

export interface SendOrganizerActivatedEmailPayload {
  to: string;
  name: string;
  organizerName: string;
  documentType: string;
  documentNumber: string;
  dashboardUrl?: string;
}

export interface SendOrganizerKycVerifiedEmailPayload {
  to: string;
  name: string;
  organizerName: string;
  verifiedAtIso?: string;
  dashboardUrl?: string;
}

export interface SendEventPublishedEmailPayload {
  to: string;
  name: string;
  eventTitle: string;
  eventPublicUrl: string;
  venueName?: string | null;
  city?: string | null;
  category?: string | null;
}

export interface SendAdvancePaidEmailPayload {
  to: string;
  name: string;
  eventTitle: string;
  amountFormatted: string;
  bankName: string;
  transferReference: string;
  paidAtIso: string;
  voucherUrl?: string | null;
}

export interface SendSettlementPaidEmailPayload {
  to: string;
  name: string;
  eventTitle: string;
  totalTicketsSold: number;
  grossAmountFormatted: string;
  couponsDiscountFormatted: string;
  platformFeeFormatted: string;
  gatewayFeeFormatted: string;
  advancesDeductedFormatted: string;
  adjustmentsFormatted: string;
  netPayoutFormatted: string;
  bankName: string;
  transferReference: string;
  paidAtIso: string;
  voucherUrl?: string | null;
}

