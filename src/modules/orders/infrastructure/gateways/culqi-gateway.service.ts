import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

export interface CulqiPublicConfig {
  publicKey: string;
  checkoutScriptUrl: string;
  threeDsScriptUrl: string;
  rsaId: string | null;
  rsaPublicKey: string | null;
  isConfigured: boolean;
}

export interface CulqiCreateOrderPayload {
  amount: number;
  currencyCode: 'PEN' | 'USD';
  description: string;
  orderNumber: string;
  clientDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  expirationDateEpochSec: number;
  metadata?: Record<string, string>;
}

export interface CulqiOrderApiResponse {
  object: string;
  id: string;
  amount: number;
  payment_code?: string | null;
  currency_code: string;
  description?: string;
  order_number?: string;
  state: 'created' | 'pending' | 'paid' | 'expired' | 'deleted' | string;
  total_fee?: number | null;
  net_amount?: number | null;
  expiration_date?: number;
  creation_date?: number;
  metadata?: Record<string, unknown>;
}

export interface CulqiAuthentication3DSDto {
  eci: string;
  xid: string;
  cavv: string;
  protocolVersion: string;
}

export interface CulqiCreateChargePayload {
  amount: number;
  currencyCode: 'PEN' | 'USD';
  email: string;
  sourceId: string;
  description: string;
  installments?: number;
  antifraudDetails: {
    firstName: string;
    lastName: string;
    address: string;
    addressCity: string;
    countryCode: string;
    phoneNumber: string;
    deviceFingerPrintId?: string;
  };
  authentication3DS?: CulqiAuthentication3DSDto;
  metadata?: Record<string, string>;
}

export interface CulqiChargeApiResponse {
  object: string;
  id: string;
  creation_date?: number;
  amount: number;
  amount_refunded?: number;
  current_amount?: number;
  installments?: number;
  currency_code: string;
  email: string;
  description?: string;
  source?: {
    id?: string;
    object?: string;
    type?: string;
    card_number?: string;
    last_four?: string;
    brand?: string;
    iin?: Record<string, unknown>;
    issuer?: Record<string, unknown>;
  };
  outcome?: {
    type?: string;
    code?: string;
    decline_code?: string;
    merchant_message?: string;
    user_message?: string;
  };
  status?: string;
  capture?: boolean;
  action_code?: string;
  metadata?: Record<string, unknown>;
}

export type CulqiChargeCallResult =
  | { status: 'PAID'; charge: CulqiChargeApiResponse }
  | { status: 'REQUIRES_3DS'; raw: Record<string, unknown> }
  | { status: 'REJECTED'; message: string; raw?: Record<string, unknown> }
  | { status: 'GATEWAY_ERROR'; message: string; raw?: Record<string, unknown> };

export type CulqiOrderCallResult =
  | { ok: true; order: CulqiOrderApiResponse }
  | { ok: false; message: string; statusCode?: number };

export type CulqiGetChargeCallResult =
  | { ok: true; charge: CulqiChargeApiResponse }
  | { ok: false; message: string; statusCode?: number };

function isPlaceholderValue(value?: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('tu_llave') ||
    normalized.includes('reemplazar') ||
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('xxxx')
  );
}

@Injectable()
export class CulqiGatewayService {
  private readonly logger = new Logger(CulqiGatewayService.name);
  private readonly apiBaseUrl: string;
  private readonly checkoutScriptUrl: string;
  private readonly threeDsScriptUrl: string;
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly rsaId: string | null;
  private readonly rsaPublicKey: string | null;
  private readonly webhookUsername: string;
  private readonly webhookPassword: string;
  private readonly timeoutMs: number;
  private readonly orderExpirationSeconds: number;

  constructor(private readonly configService: ConfigService) {
    const rawBaseUrl =
      this.configService.get<string>('CULQI_API_BASE_URL') || 'https://api.culqi.com/v2';
    this.apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');
    this.checkoutScriptUrl = (
      this.configService.get<string>('CULQI_CHECKOUT_JS_URL') || 'https://js.culqi.com/checkout-js'
    ).trim();
    this.threeDsScriptUrl = (
      this.configService.get<string>('CULQI_3DS_JS_URL') || 'https://3ds.culqi.com'
    ).trim();
    this.publicKey = (this.configService.get<string>('CULQI_PUBLIC_KEY') || '').trim();
    this.secretKey = (this.configService.get<string>('CULQI_SECRET_KEY') || '').trim();

    const rawRsaId = (this.configService.get<string>('CULQI_RSA_ID') || '').trim();
    const rawRsaPub = (this.configService.get<string>('CULQI_RSA_PUBLIC_KEY') || '').trim();
    this.rsaId = rawRsaId || null;
    this.rsaPublicKey = rawRsaPub ? rawRsaPub.replace(/\\n/g, '\n') : null;

    this.webhookUsername = (this.configService.get<string>('CULQI_WEBHOOK_USERNAME') || '').trim();
    this.webhookPassword = (this.configService.get<string>('CULQI_WEBHOOK_PASSWORD') || '').trim();

    const parsedTimeout = Number(this.configService.get<string>('CULQI_TIMEOUT_MS'));
    this.timeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout >= 3000 && parsedTimeout <= 30000
        ? parsedTimeout
        : 15000;

    const parsedExpiration = Number(
      this.configService.get<string>('CULQI_ORDER_EXPIRATION_SECONDS'),
    );
    this.orderExpirationSeconds =
      Number.isFinite(parsedExpiration) && parsedExpiration >= 300
        ? Math.floor(parsedExpiration)
        : 900;
  }

  /**
   * Indica si las credenciales mínimas de Culqi (llave pública y secreta) están configuradas.
   */
  isConfigured(): boolean {
    return (
      !isPlaceholderValue(this.publicKey) &&
      !isPlaceholderValue(this.secretKey) &&
      /^pk_(test|live)_/.test(this.publicKey) &&
      /^sk_(test|live)_/.test(this.secretKey)
    );
  }

  /**
   * Expone únicamente la configuración pública permitida para el navegador del comprador.
   */
  getPublicConfig(): CulqiPublicConfig {
    return {
      publicKey: isPlaceholderValue(this.publicKey) ? '' : this.publicKey,
      checkoutScriptUrl: this.checkoutScriptUrl,
      threeDsScriptUrl: this.threeDsScriptUrl,
      rsaId: this.rsaId,
      rsaPublicKey: this.rsaPublicKey,
      isConfigured: this.isConfigured(),
    };
  }

  /**
   * Retorna la vigencia operativa en segundos para órdenes creadas en Culqi.
   */
  getOrderExpirationSeconds(): number {
    return this.orderExpirationSeconds;
  }

  /**
   * Crea una Orden de Pago en Culqi API v2 (habilita Yape, Billeteras QR, PagoEfectivo y Cuotéalo en Checkout v4).
   *
   * @param payload - Parámetros de orden validados y calculados en el servidor
   * @returns Resultado tipado con la orden Culqi creada o detalle de error
   */
  async createOrder(payload: CulqiCreateOrderPayload): Promise<CulqiOrderCallResult> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'Credenciales de Culqi no configuradas en el entorno.' };
    }

    const requestBody = {
      amount: Math.round(payload.amount),
      currency_code: payload.currencyCode,
      description: payload.description.slice(0, 80),
      order_number: payload.orderNumber.slice(0, 30),
      client_details: {
        first_name: payload.clientDetails.firstName.slice(0, 50),
        last_name: payload.clientDetails.lastName.slice(0, 50),
        email: payload.clientDetails.email,
        phone_number: payload.clientDetails.phoneNumber,
      },
      expiration_date: Math.floor(payload.expirationDateEpochSec),
      confirm: false,
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const data = await this.safeParseJson(response);

      if (!response.ok || !data?.id) {
        const message = this.extractCulqiErrorMessage(
          data,
          `Error ${response.status} al crear la orden en Culqi.`,
        );
        this.logger.warn(
          `[Culqi createOrder] Fallo HTTP ${response.status} para order_number=${payload.orderNumber}: ${message}`,
        );
        return { ok: false, message, statusCode: response.status };
      }

      return { ok: true, order: data as unknown as CulqiOrderApiResponse };
    } catch (error: any) {
      this.logger.error(
        `[Culqi createOrder] Error de red/timeout al crear orden ${payload.orderNumber}: ${error?.message || error}`,
      );
      return {
        ok: false,
        message: 'Tiempo de espera agotado o error de conexión con Culqi.',
      };
    }
  }

  /**
   * Consulta el estado oficial actualizado de una orden directamente en Culqi API v2.
   *
   * @param culqiOrderId - Identificador de orden en Culqi (`ord_...`)
   * @returns Estado actualizado de la orden o error controlado
   */
  async getOrder(culqiOrderId: string): Promise<CulqiOrderCallResult> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'Credenciales de Culqi no configuradas en el entorno.' };
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/orders/${encodeURIComponent(culqiOrderId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );

      const data = await this.safeParseJson(response);
      if (!response.ok || !data?.id) {
        const message = this.extractCulqiErrorMessage(
          data,
          `Error ${response.status} al consultar orden Culqi.`,
        );
        return { ok: false, message, statusCode: response.status };
      }

      return { ok: true, order: data as unknown as CulqiOrderApiResponse };
    } catch (error: any) {
      this.logger.error(
        `[Culqi getOrder] Error consultando orden ${culqiOrderId}: ${error?.message || error}`,
      );
      return { ok: false, message: 'No se pudo consultar el estado actual en Culqi.' };
    }
  }

  /**
   * Ejecuta un cargo directo contra Culqi API v2 (`POST /v2/charges`) usando el token generado en Checkout v4.
   * Soporta desafío 3D Secure (HTTP 200 / `action_code === 'REVIEW'`).
   *
   * @param payload - Datos del cargo y antifraude validados por el backend
   * @returns Resultado discriminado (`PAID`, `REQUIRES_3DS`, `REJECTED`, `GATEWAY_ERROR`)
   */
  async createCharge(payload: CulqiCreateChargePayload): Promise<CulqiChargeCallResult> {
    if (!this.isConfigured()) {
      return {
        status: 'GATEWAY_ERROR',
        message: 'Credenciales de Culqi no configuradas en el entorno.',
      };
    }

    const requestBody: Record<string, unknown> = {
      amount: Math.round(payload.amount),
      currency_code: payload.currencyCode,
      email: payload.email,
      source_id: payload.sourceId,
      capture: true,
      description: payload.description.slice(0, 80),
      ...(payload.installments !== undefined ? { installments: payload.installments } : {}),
      antifraud_details: {
        first_name: payload.antifraudDetails.firstName.slice(0, 50),
        last_name: payload.antifraudDetails.lastName.slice(0, 50),
        address: payload.antifraudDetails.address.slice(0, 100),
        address_city: payload.antifraudDetails.addressCity.slice(0, 50),
        country_code: payload.antifraudDetails.countryCode,
        phone_number: payload.antifraudDetails.phoneNumber,
        ...(payload.antifraudDetails.deviceFingerPrintId
          ? { device_finger_print_id: payload.antifraudDetails.deviceFingerPrintId }
          : {}),
      },
      ...(payload.authentication3DS ? { authentication_3DS: payload.authentication3DS } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/charges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const data = await this.safeParseJson(response);

      // Según especificación de Culqi 3DS: cuando el emisor exige desafío 3DS,
      // /v2/charges responde HTTP 200 con action_code 'REVIEW' sin emitir el objeto charge final.
      if (
        response.status === 200 &&
        (!data?.object || data?.action_code === 'REVIEW') &&
        !payload.authentication3DS
      ) {
        return {
          status: 'REQUIRES_3DS',
          raw: data || {},
        };
      }

      if (response.status >= 500) {
        const message = this.extractCulqiErrorMessage(
          data,
          'El servicio de Culqi presentó una incidencia temporal. Inténtalo en unos segundos.',
        );
        this.logger.error(`[Culqi createCharge] Error servidor Culqi HTTP ${response.status}: ${message}`);
        return { status: 'GATEWAY_ERROR', message, raw: data || undefined };
      }

      if (!response.ok) {
        const message = this.extractCulqiErrorMessage(
          data,
          'El pago fue rechazado por tu banco o emisor. Verifica tu medio de pago e intenta nuevamente.',
        );
        this.logger.warn(
          `[Culqi createCharge] Cargo rechazado HTTP ${response.status}: ${message}`,
        );
        return { status: 'REJECTED', message, raw: data || undefined };
      }

      const charge = data as unknown as CulqiChargeApiResponse;
      const isApprovedOutcome =
        charge?.object === 'charge' &&
        Boolean(charge?.id) &&
        (!charge?.outcome?.type || charge.outcome.type === 'venta_exitosa');

      if (!isApprovedOutcome) {
        const message = this.extractCulqiErrorMessage(
          data,
          'La transacción no pudo ser autorizada por el emisor.',
        );
        return { status: 'REJECTED', message, raw: data || undefined };
      }

      return { status: 'PAID', charge };
    } catch (error: any) {
      this.logger.error(
        `[Culqi createCharge] Error de red/timeout al cobrar: ${error?.message || error}`,
      );
      return {
        status: 'GATEWAY_ERROR',
        message: 'No se pudo confirmar la respuesta de Culqi por tiempo de espera.',
      };
    }
  }

  /**
   * Consulta un cargo existente en Culqi API v2 (`GET /v2/charges/:id`) para verificación servidor-a-servidor.
   *
   * @param culqiChargeId - Identificador de cargo en Culqi (`chr_...`)
   * @returns Datos oficiales del cargo o error controlado
   */
  async getCharge(culqiChargeId: string): Promise<CulqiGetChargeCallResult> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'Credenciales de Culqi no configuradas en el entorno.' };
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/charges/${encodeURIComponent(culqiChargeId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );

      const data = await this.safeParseJson(response);
      if (!response.ok || !data?.id) {
        const message = this.extractCulqiErrorMessage(
          data,
          `Error ${response.status} al consultar cargo Culqi.`,
        );
        return { ok: false, message, statusCode: response.status };
      }

      return { ok: true, charge: data as unknown as CulqiChargeApiResponse };
    } catch (error: any) {
      this.logger.error(
        `[Culqi getCharge] Error consultando cargo ${culqiChargeId}: ${error?.message || error}`,
      );
      return { ok: false, message: 'No se pudo verificar el cargo con Culqi.' };
    }
  }

  /**
   * Verifica la cabecera Basic Auth enviada por el Webhook de Culqi usando comparación en tiempo constante.
   * En producción exige credenciales configuradas; en desarrollo avisa si aún no se definieron.
   *
   * @param authorizationHeader - Cabecera HTTP `Authorization` recibida en el webhook
   * @returns `true` si la autenticación es válida
   */
  verifyWebhookBasicAuth(authorizationHeader?: string): boolean {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const hasConfiguredCredentials =
      Boolean(this.webhookUsername) && Boolean(this.webhookPassword);

    if (!hasConfiguredCredentials) {
      if (isProduction) {
        this.logger.error(
          '[Culqi Webhook] Rechazado en producción: CULQI_WEBHOOK_USERNAME y CULQI_WEBHOOK_PASSWORD no configurados.',
        );
        return false;
      }
      this.logger.warn(
        '[Culqi Webhook] Advertencia: ejecutando verificación por API activa sin Basic Auth configurada en entorno local.',
      );
      return true;
    }

    if (!authorizationHeader || !authorizationHeader.startsWith('Basic ')) {
      return false;
    }

    try {
      const encoded = authorizationHeader.slice('Basic '.length).trim();
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex <= 0) return false;

      const user = decoded.slice(0, separatorIndex);
      const pass = decoded.slice(separatorIndex + 1);

      return this.safeCompareStrings(user, this.webhookUsername) &&
        this.safeCompareStrings(pass, this.webhookPassword);
    } catch {
      return false;
    }
  }

  private safeCompareStrings(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private async safeParseJson(response: Response): Promise<Record<string, any> | null> {
    try {
      const text = await response.text();
      if (!text) return null;
      return JSON.parse(text) as Record<string, any>;
    } catch {
      return null;
    }
  }

  private extractCulqiErrorMessage(
    data: Record<string, any> | null,
    fallback: string,
  ): string {
    if (!data) return fallback;
    if (typeof data.user_message === 'string' && data.user_message.trim()) {
      return data.user_message.trim();
    }
    if (typeof data.merchant_message === 'string' && data.merchant_message.trim()) {
      return data.merchant_message.trim();
    }
    if (typeof data.outcome?.user_message === 'string' && data.outcome.user_message.trim()) {
      return data.outcome.user_message.trim();
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
    return fallback;
  }
}

