import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { randomBytes } from 'crypto';
import { ok, err, Result } from 'neverthrow';
import { GetGoogleAuthUrlQuery } from '../get-google-auth-url.query';
import { GoogleAuthUrlResponseDto } from '@auth/interfaces/http/v1/google-auth/dto/google-auth-url.response.dto';
import { GoogleOAuthService } from '@auth/infrastructure/adapters/google-oauth.service';
import { RedisService } from '@modules/redis/redis.service';
import { AppError } from '@common/errors/app-errors';

const GOOGLE_STATE_PREFIX = 'qph:oauth:google:state:';
const GOOGLE_STATE_TTL_SECONDS = 600; // 10 minutos

function sanitizeSafeRedirect(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '/';
  const trimmed = raw.trim();
  // Solo permite rutas internas relativas (previene Open Redirect)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  return '/';
}

@Injectable()
@QueryHandler(GetGoogleAuthUrlQuery)
export class GetGoogleAuthUrlHandler implements IQueryHandler<GetGoogleAuthUrlQuery> {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Genera la URL segura de autenticación con Google guardando un `state` CSRF de un solo uso en Redis.
   */
  async execute(
    query: GetGoogleAuthUrlQuery,
  ): Promise<Result<GoogleAuthUrlResponseDto, AppError>> {
    if (!this.googleOAuthService.isConfigured()) {
      return err('GATEWAY_NOT_CONFIGURED');
    }

    const state = randomBytes(32).toString('hex');
    const safeRedirect = sanitizeSafeRedirect(query.redirectTo);

    await this.redisService.set(
      `${GOOGLE_STATE_PREFIX}${state}`,
      {
        redirectTo: safeRedirect,
        createdAt: new Date().toISOString(),
      },
      GOOGLE_STATE_TTL_SECONDS,
    );

    const url = this.googleOAuthService.buildAuthorizationUrl(state);

    return ok(
      plainToInstance(
        GoogleAuthUrlResponseDto,
        { url },
        { excludeExtraneousValues: true },
      ),
    );
  }
}

