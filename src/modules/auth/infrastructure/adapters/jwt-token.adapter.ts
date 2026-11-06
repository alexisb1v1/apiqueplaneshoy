import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes } from 'crypto';
import {
  TokenService,
  AuthTokenPayload,
  EmailVerificationTokenPayload,
} from '@auth/domain/ports/token-service.port';
import { RedisService } from '@modules/redis/redis.service';

const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días

@Injectable()
export class JwtTokenAdapter implements TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) { }

  generateToken(payload: AuthTokenPayload): string {
    return this.jwtService.sign(payload);
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      return this.jwtService.verify<AuthTokenPayload>(token);
    } catch {
      return null;
    }
  }

  generateEmailVerificationToken(payload: { sub: string; email: string }): string {
    return this.jwtService.sign(
      {
        sub: payload.sub,
        email: payload.email,
        type: 'email_verification',
      },
      {
        expiresIn: '24h',
      },
    );
  }

  verifyEmailVerificationToken(token: string): EmailVerificationTokenPayload | null {
    try {
      const decoded = this.jwtService.verify<EmailVerificationTokenPayload>(token);
      if (decoded.type !== 'email_verification') {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Genera un Refresh Token criptográfico de larga duración (30 días)
   * respaldado en Redis con rotación de seguridad (Token Rotation).
   */
  async generateRefreshToken(payload: { userId: number; publicUuid: string }): Promise<string> {
    const tokenUuid = randomUUID();
    const tokenSecret = randomBytes(24).toString('hex');
    const refreshToken = `${payload.userId}.${tokenUuid}.${tokenSecret}`;

    const redisKey = `qph:auth:refresh:${payload.userId}:${tokenUuid}`;
    const redisValue = {
      userId: payload.userId,
      publicUuid: payload.publicUuid,
      tokenSecret,
      createdAt: new Date().toISOString(),
    };

    await this.redisService.set(redisKey, redisValue, REFRESH_TOKEN_TTL_SECONDS);
    return refreshToken;
  }

  /**
   * Valida un Refresh Token y lo consume de inmediato para rotación atómica
   */
  async verifyAndRotateRefreshToken(
    refreshToken: string,
  ): Promise<{ userId: number; publicUuid: string } | null> {
    if (!refreshToken || typeof refreshToken !== 'string') return null;

    const parts = refreshToken.split('.');
    if (parts.length !== 3) return null;

    const [userIdStr, tokenUuid, tokenSecret] = parts;
    const userId = Number(userIdStr);
    if (isNaN(userId)) return null;

    const redisKey = `qph:auth:refresh:${userId}:${tokenUuid}`;
    const stored = await this.redisService.get<{
      userId: number;
      publicUuid: string;
      tokenSecret: string;
    }>(redisKey);

    if (!stored || stored.tokenSecret !== tokenSecret) {
      return null;
    }

    // Token Rotation: borramos el refresh token consumido
    await this.redisService.del(redisKey);

    return {
      userId: stored.userId,
      publicUuid: stored.publicUuid,
    };
  }

  /**
   * Revoca un Refresh Token específico (Logout individual)
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    if (!refreshToken || typeof refreshToken !== 'string') return;
    const parts = refreshToken.split('.');
    if (parts.length < 2) return;
    const [userIdStr, tokenUuid] = parts;
    const userId = Number(userIdStr);
    if (!isNaN(userId)) {
      await this.redisService.del(`qph:auth:refresh:${userId}:${tokenUuid}`);
    }
  }

  /**
   * Revoca todos los Refresh Tokens del usuario (Logout en todos los dispositivos)
   */
  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    await this.redisService.delPattern(`qph:auth:refresh:${userId}:*`);
  }
}
