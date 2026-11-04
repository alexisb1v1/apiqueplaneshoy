import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { RefreshTokenCommand } from '../refresh-token.command';
import { RefreshTokenResponseDto } from '@auth/interfaces/http/v1/refresh-token/dto/refresh-token.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand> {
  private readonly logger = new Logger(RefreshTokenHandler.name);

  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    command: RefreshTokenCommand,
  ): Promise<Result<RefreshTokenResponseDto, AppError>> {
    const { refreshToken } = command.dto;

    if (!refreshToken) {
      return err('UNAUTHORIZED');
    }

    // 1. Validar y rotar el Refresh Token atómicamente en Redis
    const validData = await this.tokenService.verifyAndRotateRefreshToken(refreshToken);

    if (!validData) {
      this.logger.warn(`Intento de renovación con Refresh Token inválido o revocado.`);
      return err('UNAUTHORIZED');
    }

    // 2. Obtener datos actuales del usuario en PostgreSQL
    const user = await this.userRepository.findById(validData.userId);
    if (!user) {
      return err('UNAUTHORIZED');
    }

    // 3. Emitir nuevo Access Token de 15 minutos
    const newAccessToken = this.tokenService.generateToken({
      sub: user.publicUuid,
      id: user.id,
      email: user.email,
      role: user.role,
      isOrganizer: user.isOrganizer,
      emailVerified: Boolean(user.emailVerifiedAt),
    });

    // 4. Emitir nuevo Refresh Token de 30 días en Redis (Token Rotation)
    const newRefreshToken = await this.tokenService.generateRefreshToken({
      userId: user.id,
      publicUuid: user.publicUuid,
    });

    return ok(new RefreshTokenResponseDto(newAccessToken, newRefreshToken, 900));
  }
}

