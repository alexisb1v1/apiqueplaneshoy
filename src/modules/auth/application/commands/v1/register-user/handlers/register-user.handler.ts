import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { RegisterUserCommand } from '../register-user.command';
import {
  RegisterUserResponseDto,
  AuthUserDto,
} from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { PasswordHasher } from '@auth/domain/ports/password-hasher.port';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { EmailService } from '@auth/domain/ports/email-service.port';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('PasswordHasher')
    private readonly passwordHasher: PasswordHasher,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
    @Inject('EmailService')
    private readonly emailService: EmailService,
  ) {}

  /**
   * Registra un nuevo usuario en la plataforma con rol 'customer' y envía correo de verificación.
   *
   * @param command - Datos del usuario a registrar: name, email, password, phone opcional.
   * @returns Result con `RegisterUserResponseDto` en caso de éxito, o `AppError` en caso de error.
   *
   * @throws ALREADY_EXISTS si el correo electrónico ya se encuentra registrado.
   * @throws INTERNAL_ERROR si falla la persistencia en base de datos.
   */
  async execute(
    command: RegisterUserCommand,
  ): Promise<Result<RegisterUserResponseDto, AppError>> {
    const { email, password, phone } = command.dto;
    const name = (command.dto.name || command.dto.fullName || '').trim();

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      return err('ALREADY_EXISTS');
    }

    const passwordHash = await this.passwordHasher.hash(password);

    try {
      const savedUser = await this.userRepository.save({
        name,
        email,
        username: email.toLowerCase().trim(),
        passwordHash,
        role: 'customer',
        isOrganizer: false,
        organizerPhone: phone || null,
        emailVerifiedAt: null,
      });

      const token = this.tokenService.generateToken({
        sub: savedUser.publicUuid,
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        isOrganizer: savedUser.isOrganizer,
        emailVerified: false,
      });

      const verificationToken = this.tokenService.generateEmailVerificationToken({
        sub: savedUser.publicUuid,
        email: savedUser.email,
      });

      await this.emailService.sendVerificationEmail(
        savedUser.email,
        savedUser.name,
        verificationToken,
      );

      const names = savedUser.name.trim().split(' ');
      const firstName = names[0] || savedUser.name;
      const lastName = names.slice(1).join(' ') || '';

      const userDto: AuthUserDto = {
        id: savedUser.publicUuid,
        name: savedUser.name,
        firstName,
        lastName,
        email: savedUser.email,
        phone: savedUser.organizerPhone,
        role: savedUser.role,
        isOrganizer: savedUser.isOrganizer,
        emailVerifiedAt: savedUser.emailVerifiedAt,
        createdAt: savedUser.createdAt,
      };

      const refreshToken = await this.tokenService.generateRefreshToken({
        userId: savedUser.id,
        publicUuid: savedUser.publicUuid,
      });

      return ok(
        new RegisterUserResponseDto(
          token,
          userDto,
          'Cuenta creada. Revisa tu correo electrónico para confirmar tu cuenta.',
          verificationToken,
          refreshToken,
          900,
        ),
      );
    } catch {
      return err('INTERNAL_ERROR');
    }
  }
}
