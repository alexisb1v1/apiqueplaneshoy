import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { EventEntity } from '@events/domain/entities/event.entity';

@Injectable()
export class IzipayService {
  private readonly logger = new Logger(IzipayService.name);

  constructor(private readonly configService: ConfigService) {}

  get shopId(): string {
    const fromConfig = this.configService.get<string>('IZIPAY_SHOP_ID');
    if (fromConfig && fromConfig !== '12345678') {
      return fromConfig;
    }
    // Si la clave pública contiene el prefijo del Shop ID (ej. 94556890:testpublickey_xxx)
    const pub = this.publicKey;
    if (pub && pub.includes(':')) {
      return pub.split(':')[0].trim();
    }
    return '12345678';
  }

  get publicKey(): string {
    return (
      this.configService.get<string>('IZIPAY_PUBLIC_KEY') ||
      '12345678:testpublickey_placeholder'
    );
  }

  get privateKey(): string {
    return (
      this.configService.get<string>('IZIPAY_PRIVATE_KEY') ||
      'testpassword_placeholder'
    );
  }

  get hmacKey(): string {
    return (
      this.configService.get<string>('IZIPAY_HMAC_SHA256_KEY') ||
      'testhmac_placeholder'
    );
  }

  get apiUrl(): string {
    const rawUrl =
      this.configService.get<string>('IZIPAY_API_URL') ||
      'https://secure.micuentaweb.pe/api-payment/V4/';
    return rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;
  }

  get clientEndpoint(): string {
    return (
      this.configService.get<string>('IZIPAY_CLIENT_ENDPOINT') ||
      'https://api.micuentaweb.pe'
    );
  }

  /**
   * Genera el formToken de Izipay llamando a V4/Charge/CreatePayment con Basic Auth
   */
  async createPaymentFormToken(
    order: OrderEntity,
    user: UserEntity,
    event: EventEntity,
  ): Promise<{ formToken: string; isSimulated: boolean }> {
    const isPlaceholder =
      this.privateKey === 'testpassword_placeholder' ||
      this.shopId === '12345678';

    // Si aún no se configuran credenciales reales de Izipay en .env, generamos un token de desarrollo controlado
    if (isPlaceholder) {
      this.logger.warn(
        `[Izipay Dev Mode] Utilizando formToken simulado para la orden #${order.id}. Configura IZIPAY_PRIVATE_KEY e IZIPAY_SHOP_ID en el archivo .env para conectar con la pasarela real de Izipay.`,
      );
      const simulatedToken = `DEMO-TOKEN-${order.id}-${crypto.randomUUID()}`;
      return { formToken: simulatedToken, isSimulated: true };
    }

    const endpoint = `${this.apiUrl}Charge/CreatePayment`;
    const basicAuth = Buffer.from(`${this.shopId}:${this.privateKey}`).toString(
      'base64',
    );

    const amountInCents = Math.round(Number(order.totalAmount) * 100);
    const orderCode = `#QPH-${order.id.padStart(6, '0')}`;

    const payload = {
      amount: amountInCents,
      currency: 'PEN',
      orderId: orderCode,
      customer: {
        email: user.email,
        billingDetails: {
          firstName: user.name || 'Cliente',
          lastName: 'QPH',
          cellPhoneNumber: user.organizerPhone || '999999999',
        },
      },
      metadata: {
        orderId: order.id,
        orderPublicUuid: order.publicUuid,
        eventId: event.id,
      },
    };

    try {
      this.logger.log(
        `[Izipay] Solicitando formToken a ${endpoint} para orden ${orderCode} por S/. ${Number(order.totalAmount).toFixed(2)} (${amountInCents} centavos)`,
      );

      // Timeout explícito de 15000ms conforme a estándares de pasarelas de pago
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[Izipay Error HTTP ${response.status}] ${errorText}`,
        );
        throw new Error(`Izipay HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.status !== 'SUCCESS' || !data.answer?.formToken) {
        this.logger.error(
          `[Izipay Error] Respuesta no exitosa: ${JSON.stringify(data)}`,
        );
        throw new Error(
          data.answer?.errorMessage ||
            'No se pudo generar el token de pago en Izipay',
        );
      }

      this.logger.log(
        `[Izipay Éxito] formToken generado correctamente para orden ${orderCode}`,
      );
      return { formToken: data.answer.formToken, isSimulated: false };
    } catch (error: any) {
      this.logger.error(
        `[Izipay Exception] Error al conectar con Izipay: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Verifica la autenticidad criptográfica de la notificación IPN / Webhook recibida de Izipay
   */
  verifyIpnSignature(krAnswerRaw: string, krHash: string): boolean {
    if (!krAnswerRaw || !krHash) {
      this.logger.warn('[Izipay IPN] Payload kr-answer o kr-hash ausente.');
      return false;
    }

    // Modo de desarrollo: Si la clave HMAC es el placeholder por defecto y no coincide, se registra advertencia
    if (this.hmacKey === 'testhmac_placeholder') {
      this.logger.warn(
        '[Izipay IPN Dev Mode] IZIPAY_HMAC_SHA256_KEY contiene el placeholder por defecto. Configura la clave HMAC de Izipay en .env para validación estricta de firma.',
      );
      return true;
    }

    try {
      const calculatedHash = crypto
        .createHmac('sha256', this.hmacKey)
        .update(krAnswerRaw)
        .digest('hex');

      const isValid = calculatedHash === krHash;
      if (!isValid) {
        this.logger.error(
          `[Izipay IPN Alerta de Seguridad] Firma HMAC no coincide. Esperado: ${calculatedHash}, Recibido: ${krHash}`,
        );
      }
      return isValid;
    } catch (err: any) {
      this.logger.error(
        `[Izipay IPN Error] Error al calcular HMAC-SHA256: ${err.message}`,
      );
      return false;
    }
  }
}

