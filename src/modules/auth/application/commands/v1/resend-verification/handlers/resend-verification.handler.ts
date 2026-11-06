import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { ResendVerificationCommand } from '../resend-verification.command';
import { ResendVerificationResponseDto } from '@auth/interfaces/http/v1/resend-verification/dto/resend-verification.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { EmailService } from '@auth/domain/ports/email-service.port';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(ResendVerificationCommand)
export class ResendVerificationHandler implements ICommandHandler<ResendVerificationCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
    @Inject('EmailService')
    private readonly emailService: EmailService,
  ) {}

  /**
   * Reenvía el correo de verificación con un nuevo token si la cuenta aún no ha sido confirmada.
   *
   * @param command - Datos del comando con el correo electrónico del usuario.
   * @returns Result con `ResendVerificationResponseDto` en caso de éxito, o `AppError` en caso de error.
   *
   * @throws NOT_FOUND si no existe una cuenta registrada con dicho correo electrónico.
   * @throws ALREADY_EXISTS si la cuenta de correo ya se encuentra verificada.
   */
  async execute(
    command: ResendVerificationCommand,
  ): Promise<Result<ResendVerificationResponseDto, AppError>> {
    const { email } = command.dto;

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return err('NOT_FOUND');
    }

    if (user.emailVerifiedAt) {
      return err('ALREADY_EXISTS');
    }

    const verificationToken = this.tokenService.generateEmailVerificationToken({
      sub: user.publicUuid,
      email: user.email,
    });

    await this.emailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationToken,
    );

    return ok(new ResendVerificationResponseDto());
  }
}
