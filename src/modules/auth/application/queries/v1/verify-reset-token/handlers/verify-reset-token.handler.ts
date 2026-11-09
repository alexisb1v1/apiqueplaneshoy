import { Injectable, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { VerifyResetTokenQuery } from '../verify-reset-token.query';
import { VerifyResetTokenResponseDto } from '@auth/interfaces/http/v1/verify-reset-token/dto/verify-reset-token.response.dto';
import { RedisService } from '@redis/redis.service';
import { AppError } from '@common/errors/app-errors';

const RESET_TOKEN_PREFIX = 'qph:pwd_reset:';

interface StoredTokenPayload {
  userId: number;
  publicUuid: string;
  email: string;
  createdAt: string;
}

@Injectable()
@QueryHandler(VerifyResetTokenQuery)
export class VerifyResetTokenHandler implements IQueryHandler<VerifyResetTokenQuery> {
  private readonly logger = new Logger(VerifyResetTokenHandler.name);

  constructor(private readonly redisService: RedisService) {}

  async execute(
    query: VerifyResetTokenQuery,
  ): Promise<Result<VerifyResetTokenResponseDto, AppError>> {
    const rawToken = query.token?.trim();
    if (!rawToken) {
      return err('TOKEN_EXPIRED_OR_INVALID');
    }

    try {
      const redisKey = `${RESET_TOKEN_PREFIX}${rawToken}`;
      const payload = await this.redisService.get<StoredTokenPayload>(redisKey);

      if (!payload || !payload.email) {
        return err('TOKEN_EXPIRED_OR_INVALID');
      }

      // Enmascarar correo para privacidad: al***@dominio.com
      const [userPart, domainPart] = payload.email.split('@');
      const maskedUser =
        userPart.length > 2
          ? `${userPart.slice(0, 2)}***`
          : `${userPart.slice(0, 1)}***`;
      const maskedEmail = `${maskedUser}@${domainPart}`;

      return ok(new VerifyResetTokenResponseDto(true, maskedEmail));
    } catch (error) {
      this.logger.error(`Error al verificar token: ${(error as Error).message}`);
      return err('INTERNAL_ERROR');
    }
  }
}

