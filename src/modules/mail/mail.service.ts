import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@auth/domain/ports/email-service.port';
import {
  EmailDeliveryResult,
  SendEmailInput,
  SendOrderTicketsEmailPayload,
} from './mail.types';
import {
  buildOrderTicketsEmailContent,
  buildPasswordChangedEmailContent,
  buildPasswordResetEmailContent,
  buildVerificationEmailContent,
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

  constructor(private readonly configService: ConfigService) {
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
   * Envía la confirmación de compra junto con el detalle de boletos y enlace al visor QR/PDF.
   */
  async sendOrderTicketsEmail(payload: SendOrderTicketsEmailPayload): Promise<EmailDeliveryResult> {
    const ticketsPortalUrl =
      payload.ticketsPortalUrl || `${this.primaryFrontendUrl}/profile/tickets`;

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
      tickets: payload.tickets,
      ticketsPortalUrl,
      supportEmail: this.replyTo,
    });

    return this.sendEmail({
      to: payload.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [{ name: 'template', value: 'order_tickets' }],
    });
  }
}
