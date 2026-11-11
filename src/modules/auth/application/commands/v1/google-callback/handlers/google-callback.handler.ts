import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';
import { Result, ok, err } from 'neverthrow';
import { GoogleCallbackCommand } from '../google-callback.command';
import {
  GoogleAuthUserDto,
  GoogleCallbackResponseDto,
} from '@auth/interfaces/http/v1/google-auth/dto/google-callback.response.dto';
import { GoogleOAuthService } from '@auth/infrastructure/adapters/google-oauth.service';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { RedisService } from '@modules/redis/redis.service';
import { UserEntity } from '@users/domain/entities/user.entity';
import { SocialIdentityEntity } from '@users/domain/entities/social-identity.entity';
import { AppError } from '@common/errors/app-errors';
import { MailService } from '@modules/mail/mail.service';

const GOOGLE_STATE_PREFIX = 'qph:oauth:google:state:';

interface StoredGoogleStatePayload {
  redirectTo?: string;
  createdAt?: string;
}

export interface GoogleCallbackExecutionResult {
  response: GoogleCallbackResponseDto;
  refreshToken: string;
}

@Injectable()
@CommandHandler(GoogleCallbackCommand)
export class GoogleCallbackHandler implements ICommandHandler<GoogleCallbackCommand> {
  private readonly logger = new Logger(GoogleCallbackHandler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly redisService: RedisService,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Completa el callback OAuth 2.0 de Google validando el token CSRF (`state`),
   * verificando la cuenta por correo electrónico como llave única y emitiendo JWT + Refresh Token.
   */
  async execute(
    command: GoogleCallbackCommand,
  ): Promise<Result<GoogleCallbackExecutionResult, AppError>> {
    const { code, state } = command.dto;

    if (!this.googleOAuthService.isConfigured()) {
      return err('GATEWAY_NOT_CONFIGURED');
    }

    const redisKey = `${GOOGLE_STATE_PREFIX}${state.trim()}`;
    const storedState = await this.redisService.get<StoredGoogleStatePayload>(redisKey);

    if (!storedState) {
      return err('TOKEN_EXPIRED_OR_INVALID');
    }

    // Consumo de un solo uso inmediato para prevenir ataques de repetición
    await this.redisService.del(redisKey);

    const googleProfile = await this.googleOAuthService.exchangeCodeForProfile(code);
    if (!googleProfile) {
      return err('INVALID_INPUT');
    }

    const normalizedEmail = googleProfile.email.trim().toLowerCase();
    const safeRedirect =
      storedState.redirectTo &&
      storedState.redirectTo.startsWith('/') &&
      !storedState.redirectTo.startsWith('//')
        ? storedState.redirectTo
        : '/';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let user: UserEntity | null = null;
      let isNewUser = false;

      // 1. Buscar vinculación social existente por proveedor + ID externo de Google
      const existingIdentity = await queryRunner.manager.findOne(SocialIdentityEntity, {
        where: {
          provider: 'google',
          providerId: googleProfile.sub,
        },
        relations: { user: true },
      });

      if (existingIdentity?.user) {
        user = existingIdentity.user;
        if (!user.emailVerifiedAt) {
          user.emailVerifiedAt = new Date();
          user = await queryRunner.manager.save(UserEntity, user);
        }
      } else {
        // 2. El correo es la llave única de negocio: validar si el usuario ya existe en `users`
        user = await queryRunner.manager.findOne(UserEntity, {
          where: { email: normalizedEmail },
        });

        if (user) {
          // Usuario existente encontrado por email -> marcar correo como verificado si estaba pendiente y vincular Google
          if (!user.emailVerifiedAt) {
            user.emailVerifiedAt = new Date();
            user = await queryRunner.manager.save(UserEntity, user);
          }

          const linkedIdentity = queryRunner.manager.create(SocialIdentityEntity, {
            userId: user.id,
            provider: 'google',
            providerId: googleProfile.sub,
          });
          await queryRunner.manager.save(SocialIdentityEntity, linkedIdentity);
        } else {
          // 3. Usuario nuevo -> registrar cuenta unificada ya verificada y vincular identidad social
          const newUser = queryRunner.manager.create(UserEntity, {
            name: googleProfile.name.slice(0, 100),
            email: normalizedEmail,
            emailVerifiedAt: new Date(),
            passwordHash: null,
            role: 'customer',
            isOrganizer: false,
          });
          user = await queryRunner.manager.save(UserEntity, newUser);
          isNewUser = true;

          const newIdentity = queryRunner.manager.create(SocialIdentityEntity, {
            userId: user.id,
            provider: 'google',
            providerId: googleProfile.sub,
          });
          await queryRunner.manager.save(SocialIdentityEntity, newIdentity);
        }
      }

      await queryRunner.commitTransaction();

      // Solo envía correo de bienvenida cuando se crea una cuenta nueva con Google
      if (isNewUser) {
        this.mailService
          .sendWelcomeGoogleEmail({
            to: user.email,
            name: user.name,
          })
          .catch(() => {});
      }

      const accessToken = this.tokenService.generateToken({
        sub: user.publicUuid,
        id: user.id,
        email: user.email,
        role: user.role,
        isOrganizer: user.isOrganizer,
        emailVerified: Boolean(user.emailVerifiedAt),
      });

      const refreshToken = await this.tokenService.generateRefreshToken({
        userId: user.id,
        publicUuid: user.publicUuid,
      });

      const names = user.name.trim().split(' ');
      const firstName = names[0] || user.name;
      const lastName = names.slice(1).join(' ') || '';

      const userDto: GoogleAuthUserDto = {
        id: user.publicUuid,
        name: user.name,
        firstName,
        lastName,
        email: user.email,
        phone: user.organizerPhone,
        role: user.role,
        isOrganizer: user.isOrganizer,
        organizerName: user.organizerName,
        organizerDocumentType: user.organizerDocumentType,
        organizerDocumentNumber: user.organizerDocumentNumber,
        organizerLogoUrl: user.organizerLogoUrl,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      };

      const response = plainToInstance(
        GoogleCallbackResponseDto,
        {
          token: accessToken,
          accessToken,
          expiresInSeconds: 900,
          user: userDto,
          userProfile: userDto,
          redirectTo: safeRedirect,
          message: 'Inicio de sesión con Google exitoso',
        },
        { excludeExtraneousValues: true },
      );

      return ok({ response, refreshToken });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Google OAuth] Error persistiendo usuario o identidad social para ${normalizedEmail}: ${(error as Error).message}`,
      );
      return err('INTERNAL_ERROR');
    } finally {
      await queryRunner.release();
    }
  }
}
