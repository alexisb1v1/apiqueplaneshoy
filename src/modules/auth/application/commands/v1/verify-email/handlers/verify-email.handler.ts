import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { VerifyEmailCommand } from '../verify-email.command';
import { VerifyEmailResponseDto } from '@auth/interfaces/http/v1/verify-email/dto/verify-email.response.dto';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Confirma la dirección de correo electrónico del usuario mediante un token criptográfico.
   *
   * @param command - Datos del comando con el token de verificación recibido.
   * @returns Result con `VerifyEmailResponseDto` en caso de éxito, o `AppError` en caso de error.
   *
   * @throws INVALID_INPUT si el token es inválido o ha expirado.
   * @throws NOT_FOUND si el usuario asociado al token no existe.
   * @throws INTERNAL_ERROR si ocurre un error de persistencia en base de datos.
   */
  async execute(
    command: VerifyEmailCommand,
  ): Promise<Result<VerifyEmailResponseDto, AppError>> {
    const { token } = command.dto;

    const payload = this.tokenService.verifyEmailVerificationToken(token);
    if (!payload) {
      return err('INVALID_INPUT');
    }

    const user = await this.userRepository.findByEmail(payload.email);
    if (!user) {
      return err('NOT_FOUND');
    }

    try {
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
        await this.userRepository.save(user);
      }

      const sessionToken = this.tokenService.generateToken({
        sub: user.publicUuid,
        id: user.id,
        email: user.email,
        role: user.role,
        isOrganizer: user.isOrganizer,
        emailVerified: true,
      });

      const names = user.name.trim().split(' ');
      const firstName = names[0] || user.name;
      const lastName = names.slice(1).join(' ') || '';

      const userDto: AuthUserDto = {
        id: user.publicUuid,
        name: user.name,
        firstName,
        lastName,
        email: user.email,
        role: user.role,
        isOrganizer: user.isOrganizer,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      };

      return ok(
        new VerifyEmailResponseDto(
          'Correo electrónico verificado exitosamente. Tu cuenta está habilitada para comprar entradas.',
          sessionToken,
          userDto,
        ),
      );
    } catch {
      return err('INTERNAL_ERROR');
    }
  }
}
