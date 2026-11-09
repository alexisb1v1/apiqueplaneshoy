import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { ResetPasswordCommand } from '../reset-password.command';
import { ResetPasswordResponseDto } from '@auth/interfaces/http/v1/reset-password/dto/reset-password.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { PasswordHasher } from '@auth/domain/ports/password-hasher.port';
import { EmailService } from '@auth/domain/ports/email-service.port';
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
@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  private readonly logger = new Logger(ResetPasswordHandler.name);

  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('PasswordHasher')
    private readonly passwordHasher: PasswordHasher,
    @Inject('EmailService')
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Restablece la contraseña del usuario tras validar el token efímero en Redis.
   * Aplica invalidación de un solo uso y envía email confirmatorio.
   */
  async execute(
    command: ResetPasswordCommand,
  ): Promise<Result<ResetPasswordResponseDto, AppError>> {
    const { token, newPassword } = command.dto;
    const rawToken = token?.trim();

    if (!rawToken || !newPassword || newPassword.length < 8) {
      return err('INVALID_INPUT');
    }

    const redisKey = `${RESET_TOKEN_PREFIX}${rawToken}`;

    try {
      // 1. Obtener y validar el token almacenado en Redis
      const payload = await this.redisService.get<StoredTokenPayload>(redisKey);
      if (!payload || !payload.userId) {
        this.logger.warn(`Intento de restablecimiento con token inexistente o expirado: ${rawToken}`);
        return err('TOKEN_EXPIRED_OR_INVALID');
      }

      // 2. Buscar usuario en la base de datos
      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        this.logger.warn(`Usuario no encontrado para id: ${payload.userId}`);
        return err('NOT_FOUND');
      }

      // 3. Hashear la nueva contraseña de forma segura con bcrypt
      const passwordHash = await this.passwordHasher.hash(newPassword);

      // 4. Actualizar usuario en PostgreSQL
      await this.userRepository.save({
        id: user.id,
        passwordHash,
      });

      // 5. Destruir token de Redis inmediatamente para garantizar que sea de un solo uso
      await this.redisService.del(redisKey);

      // 6. Enviar correo de confirmación de cambio de contraseña
      await this.emailService.sendPasswordChangedNotificationEmail(user.email, user.name);

      this.logger.log(`Contraseña restablecida exitosamente para el usuario: ${user.email}`);

      return ok(
        new ResetPasswordResponseDto(
          'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tus nuevas credenciales.',
        ),
      );
    } catch (error) {
      this.logger.error(`Error en ResetPasswordHandler: ${(error as Error).message}`, (error as Error).stack);
      return err('INTERNAL_ERROR');
    }
  }
}

