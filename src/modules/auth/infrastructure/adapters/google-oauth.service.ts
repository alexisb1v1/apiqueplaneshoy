import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GoogleOAuthProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName?: string;
  familyName?: string;
}

function isPlaceholder(value?: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('tu_google') ||
    normalized.includes('reemplazar') ||
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('xxxx')
  );
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.clientId = (this.configService.get<string>('GOOGLE_CLIENT_ID') || '').trim();
    this.clientSecret = (this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '').trim();

    const explicitCallback = (this.configService.get<string>('GOOGLE_CALLBACK_URL') || '').trim();
    const rawFrontendUrls = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000').trim();
    const primaryFrontendUrl = rawFrontendUrls.split(',')[0].trim().replace(/\/+$/, '');

    this.callbackUrl = explicitCallback || `${primaryFrontendUrl}/auth/google/callback`;

    const parsedTimeout = Number(this.configService.get<string>('GOOGLE_TIMEOUT_MS'));
    this.timeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout >= 2000 && parsedTimeout <= 15000
        ? parsedTimeout
        : 5000;
  }

  /**
   * Indica si las credenciales OAuth 2.0 de Google están configuradas.
   */
  isConfigured(): boolean {
    return !isPlaceholder(this.clientId) && !isPlaceholder(this.clientSecret);
  }

  /**
   * Construye la URL oficial de autorización OAuth 2.0 de Google con protección CSRF (`state`).
   */
  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Intercambia el código de autorización recibido en `/auth/google/callback` por el perfil verificado de Google.
   */
  async exchangeCodeForProfile(code: string): Promise<GoogleOAuthProfile | null> {
    if (!this.isConfigured() || !code?.trim()) {
      return null;
    }

    try {
      const tokenBody = new URLSearchParams({
        code: code.trim(),
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.callbackUrl,
        grant_type: 'authorization_code',
      });

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: tokenBody.toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const tokenData = (await tokenResponse.json().catch(() => null)) as Record<string, unknown> | null;
      const accessToken =
        tokenResponse.ok && typeof tokenData?.access_token === 'string'
          ? tokenData.access_token
          : null;

      if (!accessToken) {
        this.logger.warn(
          `[Google OAuth] Fallo al intercambiar authorization_code (status=${tokenResponse.status}).`,
        );
        return null;
      }

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const userInfo = (await userInfoResponse.json().catch(() => null)) as Record<string, unknown> | null;
      if (!userInfoResponse.ok || !userInfo) {
        this.logger.warn(
          `[Google OAuth] Fallo al consultar userinfo (status=${userInfoResponse.status}).`,
        );
        return null;
      }

      const sub = typeof userInfo.sub === 'string' ? userInfo.sub.trim() : '';
      const email = typeof userInfo.email === 'string' ? userInfo.email.trim().toLowerCase() : '';
      const emailVerified = userInfo.email_verified === true;
      const name = typeof userInfo.name === 'string' ? userInfo.name.trim() : '';
      const givenName = typeof userInfo.given_name === 'string' ? userInfo.given_name.trim() : undefined;
      const familyName = typeof userInfo.family_name === 'string' ? userInfo.family_name.trim() : undefined;

      if (!sub || !email || !emailVerified) {
        this.logger.warn('[Google OAuth] Perfil sin sub o con correo electrónico no verificado por Google.');
        return null;
      }

      return {
        sub,
        email,
        emailVerified,
        name: name || `${givenName || ''} ${familyName || ''}`.trim() || email.split('@')[0],
        givenName,
        familyName,
      };
    } catch (error) {
      this.logger.error(
        `[Google OAuth] Error de red o timeout comunicándose con Google: ${(error as Error).message}`,
      );
      return null;
    }
  }
}

