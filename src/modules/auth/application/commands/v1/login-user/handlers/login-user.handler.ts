import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { LoginUserCommand } from '../login-user.command';
import { LoginUserResponseDto } from '@auth/interfaces/http/v1/login-user/dto/login-user.response.dto';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { PasswordHasher } from '@auth/domain/ports/password-hasher.port';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(LoginUserCommand)
export class LoginUserHandler implements ICommandHandler<LoginUserCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('PasswordHasher')
    private readonly passwordHasher: PasswordHasher,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Autentica a un usuario verificando sus credenciales de acceso.
   *
   * @param command - Datos de login del usuario: email y password.
   * @returns Result con `LoginUserResponseDto` en caso exitoso, o `AppError` en caso de error.
   *
   * @throws UNAUTHORIZED si el correo no existe o la contraseña no coincide.
   */
  async execute(
    command: LoginUserCommand,
  ): Promise<Result<LoginUserResponseDto, AppError>> {
    const { email, password } = command.dto;

    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      return err('UNAUTHORIZED');
    }

    const isPasswordValid = await this.passwordHasher.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return err('UNAUTHORIZED');
    }

    const token = this.tokenService.generateToken({
      sub: user.publicUuid,
      id: user.id,
      email: user.email,
      role: user.role,
      isOrganizer: user.isOrganizer,
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
      phone: user.organizerPhone,
      role: user.role,
      isOrganizer: user.isOrganizer,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };

    return ok(new LoginUserResponseDto(token, userDto));
  }
}
