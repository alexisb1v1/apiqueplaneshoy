import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { Result, ok, err } from 'neverthrow';
import { ChangePasswordCommand } from '../change-password.command';
import { ChangePasswordResponseDto } from '@auth/interfaces/http/v1/change-password/dto/change-password.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { PasswordHasher } from '@auth/domain/ports/password-hasher.port';
import { EmailService } from '@auth/domain/ports/email-service.port';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  private readonly logger = new Logger(ChangePasswordHandler.name);

  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('PasswordHasher')
    private readonly passwordHasher: PasswordHasher,
    @Inject('EmailService')
    private readonly emailService: EmailService,
  ) {}

  /**
   * Actualiza la contraseña del usuario autenticado tras validar su credencial actual.
   *
   * @param command - UUID público del usuario autenticado y contraseñas actual/nueva
   * @returns Result con ChangePasswordResponseDto o AppError tipado
   */
  async execute(
    command: ChangePasswordCommand,
  ): Promise<Result<ChangePasswordResponseDto, AppError>> {
    const { publicUuid, dto } = command;

    if (!publicUuid) {
      return err('UNAUTHORIZED');
    }

    if (!dto.oldPassword || !dto.newPassword || dto.newPassword.length < 6) {
      return err('INVALID_INPUT');
    }

    if (dto.oldPassword === dto.newPassword) {
      return err('INVALID_INPUT');
    }

    const user = await this.userRepository.findByPublicUuid(publicUuid);
    if (!user) {
      return err('NOT_FOUND');
    }

    if (!user.passwordHash) {
      return err('INVALID_INPUT');
    }

    const isCurrentPasswordValid = await this.passwordHasher.compare(
      dto.oldPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      return err('INVALID_CURRENT_PASSWORD');
    }

    try {
      const nextPasswordHash = await this.passwordHasher.hash(dto.newPassword);
      await this.userRepository.save({
        id: user.id,
        passwordHash: nextPasswordHash,
      });

      // Notificación informativa no bloqueante si falla el envío de correo
      this.emailService
        .sendPasswordChangedNotificationEmail(user.email, user.name)
        .catch((mailError: Error) => {
          this.logger.warn(
            `No se pudo enviar notificación de cambio de clave al usuario id=${user.id}: ${mailError?.message}`,
          );
        });

      return ok(
        plainToInstance(
          ChangePasswordResponseDto,
          { message: 'Tu contraseña ha sido actualizada exitosamente.' },
          { excludeExtraneousValues: true },
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error cambiando contraseña para usuario id=${user.id}: ${(error as Error).message}`,
      );
      return err('INTERNAL_ERROR');
    }
  }
}

