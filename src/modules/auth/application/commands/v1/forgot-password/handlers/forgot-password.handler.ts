import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import * as crypto from 'crypto';
import { ForgotPasswordCommand } from '../forgot-password.command';
import { ForgotPasswordResponseDto } from '@auth/interfaces/http/v1/forgot-password/dto/forgot-password.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { EmailService } from '@auth/domain/ports/email-service.port';
import { RedisService } from '@redis/redis.service';
import { AppError } from '@common/errors/app-errors';

// TTL de 15 minutos (900 segundos) para el token de recuperación
const RESET_TOKEN_TTL_SECONDS = 900;
const RESET_TOKEN_PREFIX = 'qph:pwd_reset:';
const EMAIL_RATE_LIMIT_PREFIX = 'qph:rate_limit:forgot_pwd:';
const MAX_REQUESTS_PER_EMAIL = 3;

@Injectable()
@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler implements ICommandHandler<ForgotPasswordCommand> {
  private readonly logger = new Logger(ForgotPasswordHandler.name);

  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('EmailService')
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Procesa la solicitud de recuperación de contraseña.
   * Aplica protección anti-enumeración de usuarios respondiendo con mensaje neutral.
   * Aplica limitación de tasa por correo electrónico en Redis para mitigar ataques de Mail Bombing.
   */
  async execute(
    command: ForgotPasswordCommand,
  ): Promise<Result<ForgotPasswordResponseDto, AppError>> {
    const { email } = command.dto;
    const normalizedEmail = email.trim().toLowerCase();

    const genericSuccessResponse = new ForgotPasswordResponseDto(
      'Si el correo electrónico se encuentra registrado en queplaneshoy, recibirás un enlace seguro para restablecer tu contraseña.',
    );

    try {
      // 1. Rate limiting por correo en Redis: máximo 3 solicitudes cada 15 minutos por email
      const emailRateLimitKey = `${EMAIL_RATE_LIMIT_PREFIX}${normalizedEmail}`;
      const currentAttempts = (await this.redisService.get<number>(emailRateLimitKey)) || 0;

      if (currentAttempts >= MAX_REQUESTS_PER_EMAIL) {
        this.logger.warn(`Límite de solicitudes alcanzado para el correo: ${normalizedEmail}`);
        // Retornamos éxito genérico para no dar pistas al atacante pero sin emitir más correos
        return ok(genericSuccessResponse);
      }

      const user = await this.userRepository.findByEmail(normalizedEmail);

      // Si el usuario no existe, incrementamos el contador para la clave y retornamos éxito genérico
      if (!user) {
        this.logger.warn(`Intento de recuperación para correo no registrado: ${normalizedEmail}`);
        await this.redisService.set(emailRateLimitKey, currentAttempts + 1, RESET_TOKEN_TTL_SECONDS);
        return ok(genericSuccessResponse);
      }

      // 2. Incrementar contador de solicitudes por este email
      await this.redisService.set(emailRateLimitKey, currentAttempts + 1, RESET_TOKEN_TTL_SECONDS);

      // 3. Generar token criptográficamente seguro
      const rawToken = crypto.randomBytes(32).toString('hex');
      const redisKey = `${RESET_TOKEN_PREFIX}${rawToken}`;

      const tokenPayload = {
        userId: user.id,
        publicUuid: user.publicUuid,
        email: user.email,
        createdAt: new Date().toISOString(),
      };

      // 4. Guardar en Redis con TTL de 15 minutos (900 segundos)
      await this.redisService.set(redisKey, tokenPayload, RESET_TOKEN_TTL_SECONDS);

      // 5. Enviar correo electrónico con el token seguro
      await this.emailService.sendPasswordResetEmail(user.email, user.name, rawToken);

      return ok(genericSuccessResponse);
    } catch (error) {
      this.logger.error(`Error en ForgotPasswordHandler: ${(error as Error).message}`, (error as Error).stack);
      return err('INTERNAL_ERROR');
    }
  }
}

