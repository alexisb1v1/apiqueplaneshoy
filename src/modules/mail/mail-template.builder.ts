import { OrderTicketEmailItem } from './mail.types';

function escapeHtml(raw?: string | null): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHttpUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return '#';
}

interface BrandedLayoutParams {
  preheader: string;
  badge: string;
  title: string;
  greeting: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  supportEmail?: string;
}

export interface RenderedEmailContent {
  subject: string;
  html: string;
  text: string;
}

function renderBrandedEmailLayout(params: BrandedLayoutParams): string {
  const safeCtaUrl = params.ctaUrl ? sanitizeHttpUrl(params.ctaUrl) : null;
  const safeSupportEmail = escapeHtml(params.supportEmail || 'soporte@queplaneshoy.com');

  const ctaBlock =
    safeCtaUrl && params.ctaLabel
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 26px 0 18px 0;">
          <tr>
            <td align="center" bgcolor="#4F46E5" style="border-radius: 12px;">
              <a href="${escapeHtml(safeCtaUrl)}" target="_blank" rel="noopener noreferrer"
                 style="display: inline-block; padding: 14px 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 12px;">
                ${escapeHtml(params.ctaLabel)}
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 0 0 18px 0; font-size: 12px; line-height: 1.5; color: #64748B; word-break: break-all;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
          <a href="${escapeHtml(safeCtaUrl)}" target="_blank" rel="noopener noreferrer" style="color: #4F46E5; text-decoration: underline;">
            ${escapeHtml(safeCtaUrl)}
          </a>
        </p>
      `
      : '';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0F172A;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px;">
      ${escapeHtml(params.preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #FFFFFF; border-radius: 18px; overflow: hidden; border: 1px solid #E2E8F0;">
            <!-- Header Marca -->
            <tr>
              <td style="background-color: #0F172A; padding: 24px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" valign="middle">
                      <span style="display: inline-block; background-color: #4F46E5; color: #FFFFFF; font-weight: 900; font-size: 13px; letter-spacing: -0.5px; padding: 6px 10px; border-radius: 8px; vertical-align: middle;">
                        QPH
                      </span>
                      <span style="margin-left: 8px; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF; vertical-align: middle;">
                        queplanes<span style="color: #818CF8;">hoy</span>
                      </span>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background-color: rgba(255,255,255,0.12); color: #E2E8F0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">
                        ${escapeHtml(params.badge)}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Cuerpo -->
            <tr>
              <td style="padding: 30px 28px 24px 28px;">
                <h1 style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; font-weight: 800; color: #0F172A;">
                  ${escapeHtml(params.title)}
                </h1>
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                  ${escapeHtml(params.greeting)}
                </p>
                <div style="font-size: 14px; line-height: 1.65; color: #334155;">
                  ${params.bodyHtml}
                </div>
                ${ctaBlock}
                ${
                  params.footerNote
                    ? `<div style="margin-top: 16px; padding: 12px 14px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 12px; line-height: 1.5; color: #475569;">${params.footerNote}</div>`
                    : ''
                }
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 18px 28px; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B;">
                  ¿Necesitas ayuda? Escríbenos a <a href="mailto:${safeSupportEmail}" style="color: #4F46E5; text-decoration: none; font-weight: 600;">${safeSupportEmail}</a>
                </p>
                <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                  © 2026 queplaneshoy. Boletería oficial con verificación criptográfica.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Construye el correo de verificación de cuenta recién registrada.
 */
export function buildVerificationEmailContent(params: {
  name: string;
  verificationUrl: string;
  supportEmail?: string;
}): RenderedEmailContent {
  const safeName = escapeHtml(params.name || 'Usuario');
  const html = renderBrandedEmailLayout({
    preheader: 'Confirma tu correo para activar tus compras y eventos en queplaneshoy.',
    badge: 'Verificación',
    title: 'Confirma tu correo electrónico',
    greeting: `Hola, ${safeName}:`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">
        ¡Gracias por registrarte en <strong>queplaneshoy</strong>! Para proteger tu cuenta y habilitar la compra de entradas y publicación de eventos, confirma tu dirección de correo haciendo clic en el siguiente botón.
      </p>
    `,
    ctaLabel: 'Confirmar mi cuenta',
    ctaUrl: params.verificationUrl,
    footerNote:
      'Este enlace tiene una vigencia de <strong>24 horas</strong>. Si no creaste una cuenta en queplaneshoy, puedes ignorar este mensaje con tranquilidad.',
    supportEmail: params.supportEmail,
  });

  const text = `Hola ${params.name || 'Usuario'}, confirma tu cuenta en queplaneshoy ingresando al siguiente enlace (vigencia 24h): ${params.verificationUrl}`;

  return {
    subject: 'Confirma tu cuenta en queplaneshoy',
    html,
    text,
  };
}

/**
 * Construye el correo de recuperación de contraseña de un solo uso (TTL 15 min).
 */
export function buildPasswordResetEmailContent(params: {
  name: string;
  resetUrl: string;
  supportEmail?: string;
}): RenderedEmailContent {
  const safeName = escapeHtml(params.name || 'Usuario');
  const html = renderBrandedEmailLayout({
    preheader: 'Enlace seguro para restablecer tu contraseña en queplaneshoy.',
    badge: 'Seguridad',
    title: 'Restablecer tu contraseña',
    greeting: `Hola, ${safeName}:`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>queplaneshoy</strong>. Haz clic en el botón inferior para crear una nueva contraseña.
      </p>
    `,
    ctaLabel: 'Crear nueva contraseña',
    ctaUrl: params.resetUrl,
    footerNote:
      'Por tu seguridad, este enlace es de <strong>un solo uso</strong> y expira en <strong>15 minutos</strong>. Si no solicitaste este cambio, ignora este correo y tu contraseña actual seguirá intacta.',
    supportEmail: params.supportEmail,
  });

  const text = `Hola ${params.name || 'Usuario'}, restablece tu contraseña en queplaneshoy mediante este enlace de un solo uso (expira en 15 minutos): ${params.resetUrl}`;

  return {
    subject: 'Restablece tu contraseña - queplaneshoy',
    html,
    text,
  };
}

/**
 * Construye el correo de alerta informativa cuando la contraseña de la cuenta fue modificada.
 */
export function buildPasswordChangedEmailContent(params: {
  name: string;
  occurredAtIso: string;
  supportEmail?: string;
}): RenderedEmailContent {
  const safeName = escapeHtml(params.name || 'Usuario');
  const formattedDate = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(new Date(params.occurredAtIso));

  const html = renderBrandedEmailLayout({
    preheader: 'Tu contraseña en queplaneshoy fue actualizada correctamente.',
    badge: 'Aviso de seguridad',
    title: 'Tu contraseña ha sido actualizada',
    greeting: `Hola, ${safeName}:`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">
        Te confirmamos que la contraseña de tu cuenta en <strong>queplaneshoy</strong> fue actualizada exitosamente el <strong>${escapeHtml(formattedDate)}</strong> (hora Perú).
      </p>
      <p style="margin: 0;">
        Si realizaste este cambio, no necesitas hacer nada más.
      </p>
    `,
    footerNote:
      '<strong>¿No fuiste tú?</strong> Si no reconoces esta actividad, restablece tu contraseña inmediatamente desde el inicio de sesión y contáctanos a soporte.',
    supportEmail: params.supportEmail,
  });

  const text = `Hola ${params.name || 'Usuario'}, tu contraseña en queplaneshoy fue actualizada el ${formattedDate}. Si no reconoces este cambio, contáctanos de inmediato.`;

  return {
    subject: 'Tu contraseña en queplaneshoy fue actualizada',
    html,
    text,
  };
}

/**
 * Construye el correo de bienvenida exclusivo para registros nuevos mediante Google OAuth.
 */
export function buildWelcomeGoogleEmailContent(params: {
  name: string;
  exploreUrl: string;
  supportEmail?: string;
}): RenderedEmailContent {
  const safeName = escapeHtml(params.name || 'Usuario');
  const html = renderBrandedEmailLayout({
    preheader: 'Tu cuenta en queplaneshoy quedó verificada automáticamente con Google.',
    badge: 'Bienvenido',
    title: '¡Bienvenido a queplaneshoy!',
    greeting: `Hola, ${safeName}:`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">
        Tu cuenta quedó creada y verificada automáticamente con <strong>Google</strong>. Ya puedes comprar entradas al instante, guardar tus eventos favoritos o publicar tus propios espectáculos como organizador.
      </p>
      <p style="margin: 0;">
        No necesitas confirmar ningún correo adicional: tu cuenta está 100% activa.
      </p>
    `,
    ctaLabel: 'Explorar cartelera de eventos',
    ctaUrl: params.exploreUrl,
    footerNote:
      'Si más adelante deseas configurar una contraseña local adicional, puedes hacerlo desde la opción "¿Olvidaste tu contraseña?" usando este mismo correo.',
    supportEmail: params.supportEmail,
  });

  const text = `¡Bienvenido a queplaneshoy, ${params.name || 'Usuario'}! Tu cuenta fue activada y verificada con Google. Explora los eventos disponibles en: ${params.exploreUrl}`;

  return {
    subject: '¡Bienvenido a queplaneshoy! Tu cuenta está lista',
    html,
    text,
  };
}

/**
 * Construye el correo de confirmación al activar el perfil de Organizador / Productora.
 */
export function buildOrganizerActivatedEmailContent(params: {
  name: string;
  organizerName: string;
  documentType: string;
  documentNumber: string;
  dashboardUrl: string;
  supportEmail?: string;
}): RenderedEmailContent {
  const safeName = escapeHtml(params.name || 'Organizador');
  const html = renderBrandedEmailLayout({
    preheader: 'Tu perfil comercial de Organizador ya está habilitado en queplaneshoy.',
    badge: 'Organizador',
    title: '¡Perfil de Organizador activado!',
    greeting: `Hola, ${safeName}:`,
    bodyHtml: `
      <p style="margin: 0 0 14px 0;">
        Habilitamos exitosamente tu perfil de <strong>Organizador / Productora</strong> en queplaneshoy. Ya puedes crear eventos, definir localidades, preventas escalonadas y cupones de descuento.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
        <tr>
          <td style="padding: 14px 16px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase;">
              Datos comerciales registrados
            </p>
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0F172A;">
              ${escapeHtml(params.organizerName)}
            </p>
            <p style="margin: 0; font-size: 13px; color: #475569;">
              Documento: ${escapeHtml(params.documentType)} ${escapeHtml(params.documentNumber)}
            </p>
          </td>
        </tr>
      </table>
    `,
    ctaLabel: 'Ir a mi panel de organizador',
    ctaUrl: params.dashboardUrl,
    footerNote:
      'Tu perfil comercial pasará por validación KYC administrativa para habilitar desembolsos de anticipos y liquidaciones.',
    supportEmail: params.supportEmail,
  });

  const text = `Hola ${params.name || 'Organizador'}, activaste tu perfil comercial "${params.organizerName}" (${params.documentType} ${params.documentNumber}) en queplaneshoy. Accede a tu panel en: ${params.dashboardUrl}`;

  return {
    subject: 'Perfil de Organizador activado en queplaneshoy',
    html,
    text,
  };
}

/**
 * Construye el correo de aprobación KYC administrativa del perfil Organizador.
 */
export function buildOrganizerKycVerifiedEmailContent(params: {
  name: string;
  organizerName: string;
  verifiedAtIso: string;
  dashboardUrl: string;
  supportEmail?: string;
}): RenderedEmailContent {
  const formattedDate = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeZone: 'America/Lima',
  }).format(new Date(params.verifiedAtIso));

  const html = renderBrandedEmailLayout({
    preheader: 'Tu verificación KYC comercial fue aprobada exitosamente.',
    badge: 'KYC Aprobado',
    title: 'Identidad comercial verificada',
    greeting: `Hola, ${escapeHtml(params.name || 'Organizador')}:`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">
        Tu productora <strong>${escapeHtml(params.organizerName)}</strong> completó satisfactoriamente la verificación KYC el <strong>${escapeHtml(formattedDate)}</strong>.
      </p>
      <p style="margin: 0;">
        Ya tienes habilitada la gestión financiera completa, solicitud de anticipos a cuenta y liquidaciones bancarias oficiales.
      </p>
    `,
    ctaLabel: 'Gestionar mis eventos',
    ctaUrl: params.dashboardUrl,
    supportEmail: params.supportEmail,
  });

  const text = `Hola ${params.name || 'Organizador'}, tu verificación KYC para "${params.organizerName}" fue aprobada el ${formattedDate}.`;

  return {
    subject: 'Verificación KYC aprobada - queplaneshoy',
    html,
    text,
  };
}

/**
 * Construye el correo de confirmación cuando un evento pasa a estado publicado en cartelera.
 */
export function buildEventPublishedEmailContent(params: {
  name: string;
  eventTitle: string;
  eventPublicUrl: string;
  venueName?: string | null;
  city?: string | null;
  category?: string | null;
  supportEmail?: string;
}): RenderedEmailContent {
  const locationLine = [params.venueName, params.city].filter(Boolean).join(', ');
  const html = renderBrandedEmailLayout({
    preheader: `Tu evento "${params.eventTitle}" ya está publicado y en venta.`,
    badge: 'Evento en vivo',
    title: '¡Tu evento ya está publicado!',
    greeting: `Hola, ${escapeHtml(params.name || 'Organizador')}:`,
    bodyHtml: `
      <p style="margin: 0 0 14px 0;">
        Confirmamos que tu evento <strong>${escapeHtml(params.eventTitle)}</strong> ya se encuentra visible en la cartelera pública oficial de <strong>queplaneshoy</strong> con venta habilitada.
      </p>
      ${
        locationLine || params.category
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
               <tr>
                 <td style="padding: 14px 16px;">
                   ${params.category ? `<p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #4F46E5; text-transform: uppercase;">${escapeHtml(params.category)}</p>` : ''}
                   <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0F172A;">${escapeHtml(params.eventTitle)}</p>
                   ${locationLine ? `<p style="margin: 0; font-size: 13px; color: #475569;">${escapeHtml(locationLine)}</p>` : ''}
                 </td>
               </tr>
             </table>`
          : ''
      }
    `,
    ctaLabel: 'Ver página pública del evento',
    ctaUrl: params.eventPublicUrl,
    footerNote:
      'Ya puedes compartir este enlace en tus redes sociales para comenzar a recibir ventas con Culqi Multipago.',
    supportEmail: params.supportEmail,
  });

  const text = `¡Tu evento "${params.eventTitle}" ya está publicado en queplaneshoy! Enlace público: ${params.eventPublicUrl}`;

  return {
    subject: `¡Tu evento "${params.eventTitle}" ya está en vivo!`,
    html,
    text,
  };
}

/**
 * Construye el correo de notificación cuando se paga un anticipo financiero al organizador.
 */
export function buildAdvancePaidEmailContent(params: {
  name: string;
  eventTitle: string;
  amountFormatted: string;
  bankName: string;
  transferReference: string;
  paidAtIso: string;
  voucherUrl?: string | null;
  supportEmail?: string;
}): RenderedEmailContent {
  const formattedDate = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(new Date(params.paidAtIso));

  const html = renderBrandedEmailLayout({
    preheader: `Transferimos tu anticipo de ${params.amountFormatted} para ${params.eventTitle}.`,
    badge: 'Finanzas · Anticipo',
    title: 'Anticipo bancario transferido',
    greeting: `Hola, ${escapeHtml(params.name || 'Organizador')}:`,
    bodyHtml: `
      <p style="margin: 0 0 14px 0;">
        Registramos el desembolso de tu anticipo correspondiente al evento <strong>${escapeHtml(params.eventTitle)}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
        <tr>
          <td style="padding: 14px 16px;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Monto abonado: <strong style="color: #059669; font-size: 15px;">${escapeHtml(params.amountFormatted)}</strong></p>
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Banco destino: <strong style="color: #0F172A;">${escapeHtml(params.bankName)}</strong></p>
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Nro. de operación: <strong style="color: #0F172A; font-family: monospace;">${escapeHtml(params.transferReference)}</strong></p>
            <p style="margin: 0; font-size: 12px; color: #64748B;">Fecha de abono: ${escapeHtml(formattedDate)}</p>
          </td>
        </tr>
      </table>
    `,
    ctaLabel: params.voucherUrl ? 'Descargar constancia de transferencia' : undefined,
    ctaUrl: params.voucherUrl || undefined,
    footerNote:
      'Este anticipo se descontará automáticamente en el cierre contable de tu liquidación final.',
    supportEmail: params.supportEmail,
  });

  const text = `Anticipo pagado por ${params.amountFormatted} para "${params.eventTitle}". Banco: ${params.bankName}. Nro. Operación: ${params.transferReference}.`;

  return {
    subject: `Anticipo pagado (${params.amountFormatted}) - ${params.eventTitle}`,
    html,
    text,
  };
}

/**
 * Construye el correo de notificación con el estado de cuenta de liquidación final pagada.
 */
export function buildSettlementPaidEmailContent(params: {
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
  supportEmail?: string;
}): RenderedEmailContent {
  const formattedDate = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(new Date(params.paidAtIso));

  const html = renderBrandedEmailLayout({
    preheader: `Liquidación final transferida (${params.netPayoutFormatted}) por ${params.eventTitle}.`,
    badge: 'Liquidación Final',
    title: 'Liquidación final pagada',
    greeting: `Hola, ${escapeHtml(params.name || 'Organizador')}:`,
    bodyHtml: `
      <p style="margin: 0 0 14px 0;">
        Completamos la transferencia de tu liquidación final oficial correspondiente al evento <strong>${escapeHtml(params.eventTitle)}</strong> (${params.totalTicketsSold} boletos vendidos).
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 14px;">
        <tr style="background-color: #F1F5F9;">
          <th align="left" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Concepto</th>
          <th align="right" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Importe</th>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155;">Ventas brutas</td>
          <td align="right" style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(params.grossAmountFormatted)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155;">(-) Descuento por cupones</td>
          <td align="right" style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">-${escapeHtml(params.couponsDiscountFormatted)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155;">(-) Comisión plataforma QPH</td>
          <td align="right" style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">-${escapeHtml(params.platformFeeFormatted)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155;">(-) Comisiones pasarela</td>
          <td align="right" style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">-${escapeHtml(params.gatewayFeeFormatted)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155;">(-) Anticipos abonados</td>
          <td align="right" style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">-${escapeHtml(params.advancesDeductedFormatted)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155;">(-) Ajustes</td>
          <td align="right" style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">-${escapeHtml(params.adjustmentsFormatted)}</td>
        </tr>
        <tr style="background-color: #ECFDF5;">
          <td style="padding: 10px 12px; font-size: 14px; font-weight: 800; color: #065F46;">Saldo neto transferido</td>
          <td align="right" style="padding: 10px 12px; font-size: 15px; font-weight: 900; color: #059669;">${escapeHtml(params.netPayoutFormatted)}</td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 12px; color: #475569;">
        <strong>Banco:</strong> ${escapeHtml(params.bankName)} · <strong>Operación:</strong> <span style="font-family: monospace;">${escapeHtml(params.transferReference)}</span> · ${escapeHtml(formattedDate)}
      </p>
    `,
    ctaLabel: params.voucherUrl ? 'Descargar voucher de liquidación' : undefined,
    ctaUrl: params.voucherUrl || undefined,
    supportEmail: params.supportEmail,
  });

  const text = `Liquidación final pagada para "${params.eventTitle}". Neto transferido: ${params.netPayoutFormatted} en ${params.bankName} (Operación: ${params.transferReference}).`;

  return {
    subject: `Liquidación final pagada (${params.netPayoutFormatted}) - ${params.eventTitle}`,
    html,
    text,
  };
}

/**
 * Construye el correo transaccional de confirmación de compra y listado de entradas emitidas (con QR inline opcional + PDF adjunto).
 */
export function buildOrderTicketsEmailContent(params: {
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
  ticketsPortalUrl: string;
  supportEmail?: string;
}): RenderedEmailContent {
  const ticketRowsHtml = params.tickets
    .map(
      (ticket) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; vertical-align: middle;">
            ${
              ticket.qrImageCid
                ? `<img src="cid:${escapeHtml(ticket.qrImageCid)}" alt="QR ${escapeHtml(ticket.ticketCode)}" width="76" height="76" style="display: block; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 6px;" />`
                : ''
            }
            <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #0F172A;">
              ${escapeHtml(ticket.ticketCode)}
            </span>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155; vertical-align: middle;">
            <strong>${escapeHtml(ticket.zoneName)}</strong>
            <span style="display: block; font-size: 11px; color: #64748B;">${escapeHtml(ticket.tierName)}</span>
          </td>
          <td align="right" style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 700; color: #0F172A; vertical-align: middle;">
            ${escapeHtml(ticket.unitPriceFormatted)}
          </td>
        </tr>
      `,
    )
    .join('');

  const discountRowHtml =
    params.couponCode && params.discountAmountFormatted
      ? `<tr>
           <td style="padding: 4px 0; font-size: 13px; color: #059669;">Cupón (${escapeHtml(params.couponCode)}):</td>
           <td align="right" style="padding: 4px 0; font-size: 13px; font-weight: 700; color: #059669;">-${escapeHtml(params.discountAmountFormatted)}</td>
         </tr>`
      : '';

  const html = renderBrandedEmailLayout({
    preheader: `Tus entradas para ${params.eventTitle} (${params.orderCode}) ya están listas.`,
    badge: 'Entradas confirmadas',
    title: '¡Tu compra está confirmada!',
    greeting: `Hola, ${escapeHtml(params.customerName || 'Comprador')}:`,
    bodyHtml: `
      <p style="margin: 0 0 16px 0;">
        Tu pago fue procesado exitosamente. Ya emitimos tus pases oficiales para <strong>${escapeHtml(params.eventTitle)}</strong>. También adjuntamos el documento <strong>PDF oficial</strong> con tus códigos QR listos para presentar en puerta.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 18px;">
        <tr>
          <td style="padding: 14px 16px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase;">
              Orden ${escapeHtml(params.orderCode)}
            </p>
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0F172A;">
              ${escapeHtml(params.eventDateFormatted)} · ${escapeHtml(params.eventTimeFormatted)}
            </p>
            <p style="margin: 0; font-size: 13px; color: #475569;">
              ${escapeHtml(params.venueName)}, ${escapeHtml(params.city)}
            </p>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
        <tr style="background-color: #F1F5F9;">
          <th align="left" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Entrada / QR</th>
          <th align="left" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Zona / Tarifa</th>
          <th align="right" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Precio</th>
        </tr>
        ${ticketRowsHtml}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${discountRowHtml}
        <tr>
          <td style="padding: 6px 0 0 0; font-size: 14px; font-weight: 800; color: #0F172A;">Total pagado:</td>
          <td align="right" style="padding: 6px 0 0 0; font-size: 16px; font-weight: 900; color: #4F46E5;">${escapeHtml(params.totalAmountFormatted)}</td>
        </tr>
      </table>
    `,
    ctaLabel: 'Ver códigos QR en la web',
    ctaUrl: params.ticketsPortalUrl,
    footerNote:
      'Descarga o guarda el PDF adjunto en tu celular antes de llegar al recinto para acceder incluso sin señal móvil. Cada código QR es único e intransferible.',
    supportEmail: params.supportEmail,
  });

  const text = `¡Compra confirmada! Orden ${params.orderCode} para ${params.eventTitle} (${params.eventDateFormatted} ${params.eventTimeFormatted} en ${params.venueName}). Total pagado: ${params.totalAmountFormatted}. Tus entradas con QR van adjuntas en PDF y disponibles en: ${params.ticketsPortalUrl}`;

  return {
    subject: `Tus entradas para ${params.eventTitle} (${params.orderCode})`,
    html,
    text,
  };
}

