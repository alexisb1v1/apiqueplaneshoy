import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@auth/domain/ports/email-service.port';
import { TicketPdfService } from './ticket-pdf.service';
import {
  EmailAttachment,
  EmailDeliveryResult,
  SendAdvancePaidEmailPayload,
  SendEmailInput,
  SendEventPublishedEmailPayload,
  SendOrderTicketsEmailPayload,
  SendOrganizerActivatedEmailPayload,
  SendOrganizerKycVerifiedEmailPayload,
  SendSettlementPaidEmailPayload,
  SendWelcomeGoogleEmailPayload,
} from './mail.types';
import {
  buildAdvancePaidEmailContent,
  buildEventPublishedEmailContent,
  buildOrderTicketsEmailContent,
  buildOrganizerActivatedEmailContent,
  buildOrganizerKycVerifiedEmailContent,
  buildPasswordChangedEmailContent,
  buildPasswordResetEmailContent,
  buildSettlementPaidEmailContent,
  buildVerificationEmailContent,
  buildWelcomeGoogleEmailContent,
} from './mail-template.builder';

function isPlaceholderValue(value?: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('reemplazar') ||
    normalized.includes('tu_resend') ||
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('xxxx')
  );
}

@Injectable()
export class MailService implements EmailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly replyTo: string;
  private readonly timeoutMs: number;
  private readonly primaryFrontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly ticketPdfService: TicketPdfService,
  ) {
    this.apiUrl = (
      this.configService.get<string>('RESEND_API_URL') || 'https://api.resend.com/emails'
    )
      .trim()
      .replace(/\/+$/, '');
    this.apiKey = (this.configService.get<string>('RESEND_API_KEY') || '').trim();
    this.fromEmail = (
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'queplaneshoy <onboarding@resend.dev>'
    ).trim();
    this.replyTo = (
      this.configService.get<string>('RESEND_REPLY_TO') || 'soporte@queplaneshoy.com'
    ).trim();

    const parsedTimeout = Number(this.configService.get<string>('RESEND_TIMEOUT_MS'));
    this.timeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout >= 2000 && parsedTimeout <= 15000
        ? parsedTimeout
        : 5000;

    const rawFrontendUrls = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).trim();
    this.primaryFrontendUrl = rawFrontendUrls.split(',')[0].trim().replace(/\/+$/, '');
  }

  /**
   * Indica si Resend tiene una API Key real configurada para envío HTTP en vivo.
   */
  isConfigured(): boolean {
    return !isPlaceholderValue(this.apiKey) && this.apiKey.startsWith('re_');
  }

  /**
   * Envía un correo electrónico mediante la API REST de Resend con timeout explícito,
   * o registra una vista previa segura en consola cuando no hay `RESEND_API_KEY` configurada (entorno local).
   */
  async sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
    const recipients = (Array.isArray(input.to) ? input.to : [input.to])
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item));

    if (recipients.length === 0) {
      return {
        ok: false,
        mode: 'error',
        errorMessage: 'No se especificó ningún destinatario válido.',
      };
    }

    if (!this.isConfigured()) {
      const isProduction = process.env.NODE_ENV === 'production';
      this.logger.warn(
        `[MailService] RESEND_API_KEY no configurada. Envío simulado para asunto "${input.subject}" (${recipients.length} destinatario(s)).`,
      );
      if (!isProduction && input.text) {
        this.logger.log(`[MailService - Preview Dev] ${input.text}`);
      }
      return { ok: true, mode: 'console' };
    }

    const requestBody: Record<string, unknown> = {
      from: this.fromEmail,
      to: recipients,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo || this.replyTo ? { reply_to: input.replyTo || this.replyTo } : {}),
      ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
      ...(input.attachments && input.attachments.length > 0
        ? {
            attachments: input.attachments.map((att) => ({
              filename: att.filename,
              content: att.content,
              ...(att.contentType ? { content_type: att.contentType } : {}),
              ...(att.contentId ? { content_id: att.contentId } : {}),
            })),
          }
        : {}),
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok || typeof data?.id !== 'string') {
        const providerError =
          (typeof data?.message === 'string' && data.message) ||
          `Error HTTP ${response.status} al enviar correo con Resend.`;
        this.logger.warn(
          `[Resend] Fallo al enviar correo a ${recipients.join(', ')}: ${providerError}`,
        );
        return {
          ok: false,
          mode: 'error',
          errorMessage: providerError,
        };
      }

      return {
        ok: true,
        mode: 'resend',
        messageId: data.id,
      };
    } catch (error) {
      const message = (error as Error)?.message || 'Error de conexión o timeout con Resend.';
      this.logger.error(`[Resend] Excepción enviando correo a ${recipients.join(', ')}: ${message}`);
      return {
        ok: false,
        mode: 'error',
        errorMessage: message,
      };
    }
  }

  /**
   * Envía el correo de verificación de cuenta al registrarse o al reenviar confirmación.
   */
  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const verificationUrl = `${this.primaryFrontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const content = buildVerificationEmailContent({
      name,
      verificationUrl,
      supportEmail: this.replyTo,
    });

    await this.sendEmail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'verify_email' }],
    });
  }

  /**
   * Envía el correo de recuperación de contraseña con enlace efímero de 15 minutos.
   */
  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.primaryFrontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const content = buildPasswordResetEmailContent({
      name,
      resetUrl,
      supportEmail: this.replyTo,
    });

    await this.sendEmail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'password_reset' }],
    });
  }

  /**
   * Envía notificación de seguridad informando que la contraseña de la cuenta fue modificada.
   */
  async sendPasswordChangedNotificationEmail(to: string, name: string): Promise<void> {
    const content = buildPasswordChangedEmailContent({
      name,
      occurredAtIso: new Date().toISOString(),
      supportEmail: this.replyTo,
    });

    await this.sendEmail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'password_changed' }],
    });
  }

  /**
   * Envía la confirmación de compra junto con el detalle de boletos, códigos QR embebidos y PDF oficial adjunto.
   */
  async sendOrderTicketsEmail(payload: SendOrderTicketsEmailPayload): Promise<EmailDeliveryResult> {
    const ticketsPortalUrl =
      payload.ticketsPortalUrl || `${this.primaryFrontendUrl}/profile/tickets`;

    const preparedTickets = payload.tickets.map((t) => ({ ...t }));
    const attachments: EmailAttachment[] = [...(payload.attachments || [])];

    if (attachments.length === 0 && preparedTickets.some((t) => Boolean(t.qrPayload))) {
      try {
        const precomputedQrs = new Map<number, Buffer>();
        const attachInlineQrs = preparedTickets.length <= 6;

        for (let i = 0; i < preparedTickets.length; i++) {
          const item = preparedTickets[i];
          if (!item.qrPayload) continue;
          const qrBuf = await this.ticketPdfService.generateQrPngBuffer(item.qrPayload);
          precomputedQrs.set(i, qrBuf);

          if (attachInlineQrs) {
            const cid = `qph-qr-${i + 1}`;
            item.qrImageCid = cid;
            attachments.push({
              filename: `qr-entrada-${i + 1}.png`,
              content: qrBuf.toString('base64'),
              contentType: 'image/png',
              contentId: cid,
            });
          }
        }

        const pdfBuffer = await this.ticketPdfService.generateTicketsPdfBuffer(
          {
            orderCode: payload.orderCode,
            txCode: payload.txCode || payload.orderCode,
            eventTitle: payload.eventTitle,
            eventDateFormatted: payload.eventDateFormatted,
            eventTimeFormatted: payload.eventTimeFormatted,
            venueName: payload.venueName,
            venueAddress: payload.venueAddress,
            city: payload.city,
            customerName: payload.customerName,
            customerEmail: payload.to,
            totalAmountFormatted: payload.totalAmountFormatted,
            tickets: preparedTickets.map((item, idx) => ({
              ticketNumber: idx + 1,
              ticketCode: item.ticketCode,
              zoneName: item.zoneName,
              tierName: item.tierName,
              unitPriceFormatted: item.unitPriceFormatted,
              qrPayload: item.qrPayload || item.ticketCode,
            })),
          },
          precomputedQrs,
        );

        const safeOrderFileSuffix = payload.orderCode.replace(/[^A-Za-z0-9_-]/g, '');
        attachments.push({
          filename: `entradas-${safeOrderFileSuffix || 'QPH'}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        });
      } catch (pdfError) {
        this.logger.warn(
          `[MailService] No se pudo generar el PDF/QR adjunto para ${payload.orderCode}: ${(pdfError as Error).message}`,
        );
      }
    }

    const content = buildOrderTicketsEmailContent({
      customerName: payload.customerName,
      orderCode: payload.orderCode,
      eventTitle: payload.eventTitle,
      eventDateFormatted: payload.eventDateFormatted,
      eventTimeFormatted: payload.eventTimeFormatted,
      venueName: payload.venueName,
      city: payload.city,
      totalAmountFormatted: payload.totalAmountFormatted,
      couponCode: payload.couponCode,
      discountAmountFormatted: payload.discountAmountFormatted,
      tickets: preparedTickets,
      ticketsPortalUrl,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'order_tickets' }],
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  /**
   * Envía bienvenida exclusiva para usuarios que crean su cuenta por primera vez con Google OAuth.
   */
  async sendWelcomeGoogleEmail(
    payload: SendWelcomeGoogleEmailPayload,
  ): Promise<EmailDeliveryResult> {
    const exploreUrl = payload.exploreUrl || `${this.primaryFrontendUrl}/events`;
    const content = buildWelcomeGoogleEmailContent({
      name: payload.name,
      exploreUrl,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'welcome_google' }],
    });
  }

  /**
   * Notifica al usuario que activó exitosamente su perfil de Organizador / Productora.
   */
  async sendOrganizerActivatedEmail(
    payload: SendOrganizerActivatedEmailPayload,
  ): Promise<EmailDeliveryResult> {
    const dashboardUrl = payload.dashboardUrl || `${this.primaryFrontendUrl}/organizer/events`;
    const content = buildOrganizerActivatedEmailContent({
      name: payload.name,
      organizerName: payload.organizerName,
      documentType: payload.documentType,
      documentNumber: payload.documentNumber,
      dashboardUrl,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'organizer_activated' }],
    });
  }

  /**
   * Notifica que la verificación KYC comercial de la productora fue aprobada.
   */
  async sendOrganizerKycVerifiedEmail(
    payload: SendOrganizerKycVerifiedEmailPayload,
  ): Promise<EmailDeliveryResult> {
    const dashboardUrl = payload.dashboardUrl || `${this.primaryFrontendUrl}/organizer/events`;
    const content = buildOrganizerKycVerifiedEmailContent({
      name: payload.name,
      organizerName: payload.organizerName,
      verifiedAtIso: payload.verifiedAtIso || new Date().toISOString(),
      dashboardUrl,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'organizer_kyc_verified' }],
    });
  }

  /**
   * Notifica al promotor que su evento ya quedó publicado en cartelera pública.
   */
  async sendEventPublishedEmail(
    payload: SendEventPublishedEmailPayload,
  ): Promise<EmailDeliveryResult> {
    const normalizedUrl = payload.eventPublicUrl.startsWith('http')
      ? payload.eventPublicUrl
      : `${this.primaryFrontendUrl}${payload.eventPublicUrl.startsWith('/') ? '' : '/'}${payload.eventPublicUrl}`;

    const content = buildEventPublishedEmailContent({
      name: payload.name,
      eventTitle: payload.eventTitle,
      eventPublicUrl: normalizedUrl,
      venueName: payload.venueName,
      city: payload.city,
      category: payload.category,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'event_published' }],
    });
  }

  /**
   * Notifica al organizador el desembolso bancario de un anticipo a cuenta.
   */
  async sendAdvancePaidEmail(payload: SendAdvancePaidEmailPayload): Promise<EmailDeliveryResult> {
    const content = buildAdvancePaidEmailContent({
      name: payload.name,
      eventTitle: payload.eventTitle,
      amountFormatted: payload.amountFormatted,
      bankName: payload.bankName,
      transferReference: payload.transferReference,
      paidAtIso: payload.paidAtIso,
      voucherUrl: payload.voucherUrl,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'advance_paid' }],
    });
  }

  /**
   * Notifica al organizador el pago y estado de cuenta oficial de la liquidación final.
   */
  async sendSettlementPaidEmail(
    payload: SendSettlementPaidEmailPayload,
  ): Promise<EmailDeliveryResult> {
    const content = buildSettlementPaidEmailContent({
      name: payload.name,
      eventTitle: payload.eventTitle,
      totalTicketsSold: payload.totalTicketsSold,
      grossAmountFormatted: payload.grossAmountFormatted,
      couponsDiscountFormatted: payload.couponsDiscountFormatted,
      platformFeeFormatted: payload.platformFeeFormatted,
      gatewayFeeFormatted: payload.gatewayFeeFormatted,
      advancesDeductedFormatted: payload.advancesDeductedFormatted,
      adjustmentsFormatted: payload.adjustmentsFormatted,
      netPayoutFormatted: payload.netPayoutFormatted,
      bankName: payload.bankName,
      transferReference: payload.transferReference,
      paidAtIso: payload.paidAtIso,
      voucherUrl: payload.voucherUrl,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'settlement_paid' }],
    });
  }
}
