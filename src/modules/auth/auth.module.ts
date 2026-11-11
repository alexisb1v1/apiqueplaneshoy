import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { UsersModule } from '@users/infrastructure/nestjs/users.module';

import { RegisterUserController } from './interfaces/http/v1/register-user/register-user.controller';
import { LoginUserController } from './interfaces/http/v1/login-user/login-user.controller';
import { GetCurrentUserController } from './interfaces/http/v1/get-current-user/get-current-user.controller';
import { VerifyEmailController } from './interfaces/http/v1/verify-email/verify-email.controller';
import { ResendVerificationController } from './interfaces/http/v1/resend-verification/resend-verification.controller';
import { UpdateProfileController } from './interfaces/http/v1/update-profile/update-profile.controller';
import { BecomeOrganizerController } from './interfaces/http/v1/become-organizer/become-organizer.controller';
import { RefreshTokenController } from './interfaces/http/v1/refresh-token/refresh-token.controller';
import { ForgotPasswordController } from './interfaces/http/v1/forgot-password/forgot-password.controller';
import { VerifyResetTokenController } from './interfaces/http/v1/verify-reset-token/verify-reset-token.controller';
import { ResetPasswordController } from './interfaces/http/v1/reset-password/reset-password.controller';
import { ChangePasswordController } from './interfaces/http/v1/change-password/change-password.controller';
import { GoogleAuthUrlController } from './interfaces/http/v1/google-auth/google-auth-url.controller';
import { GoogleCallbackController } from './interfaces/http/v1/google-auth/google-callback.controller';

import { RegisterUserHandler } from './application/commands/v1/register-user/handlers/register-user.handler';
import { LoginUserHandler } from './application/commands/v1/login-user/handlers/login-user.handler';
import { GetCurrentUserHandler } from './application/queries/v1/get-current-user/handlers/get-current-user.handler';
import { VerifyEmailHandler } from './application/commands/v1/verify-email/handlers/verify-email.handler';
import { ResendVerificationHandler } from './application/commands/v1/resend-verification/handlers/resend-verification.handler';
import { UpdateProfileHandler } from './application/commands/v1/update-profile/handlers/update-profile.handler';
import { BecomeOrganizerHandler } from './application/commands/v1/become-organizer/handlers/become-organizer.handler';
import { RefreshTokenHandler } from './application/commands/v1/refresh-token/handlers/refresh-token.handler';
import { ForgotPasswordHandler } from './application/commands/v1/forgot-password/handlers/forgot-password.handler';
import { VerifyResetTokenHandler } from './application/queries/v1/verify-reset-token/handlers/verify-reset-token.handler';
import { ResetPasswordHandler } from './application/commands/v1/reset-password/handlers/reset-password.handler';
import { ChangePasswordHandler } from './application/commands/v1/change-password/handlers/change-password.handler';
import { GetGoogleAuthUrlHandler } from './application/queries/v1/get-google-auth-url/handlers/get-google-auth-url.handler';
import { GoogleCallbackHandler } from './application/commands/v1/google-callback/handlers/google-callback.handler';

import { BcryptPasswordHasher } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from './infrastructure/adapters/jwt-token.adapter';
import { ConsoleEmailAdapter } from './infrastructure/adapters/console-email.adapter';
import { GoogleOAuthService } from './infrastructure/adapters/google-oauth.service';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';

const CommandHandlers = [
  RegisterUserHandler,
  LoginUserHandler,
  VerifyEmailHandler,
  ResendVerificationHandler,
  UpdateProfileHandler,
  BecomeOrganizerHandler,
  RefreshTokenHandler,
  ForgotPasswordHandler,
  ResetPasswordHandler,
  ChangePasswordHandler,
  GoogleCallbackHandler,
];
const QueryHandlers = [
  GetCurrentUserHandler,
  VerifyResetTokenHandler,
  GetGoogleAuthUrlHandler,
];
const Controllers = [
  RegisterUserController,
  LoginUserController,
  VerifyEmailController,
  ResendVerificationController,
  GetCurrentUserController,
  UpdateProfileController,
  BecomeOrganizerController,
  RefreshTokenController,
  ForgotPasswordController,
  VerifyResetTokenController,
  ResetPasswordController,
  ChangePasswordController,
  GoogleAuthUrlController,
  GoogleCallbackController,
];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'qph-secret-jwt-key-2026-secure',
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    {
      provide: 'PasswordHasher',
      useClass: BcryptPasswordHasher,
    },
    BcryptPasswordHasher,
    {
      provide: 'TokenService',
      useClass: JwtTokenAdapter,
    },
    JwtTokenAdapter,
    {
      provide: 'EmailService',
      useClass: ConsoleEmailAdapter,
    },
    ConsoleEmailAdapter,
    GoogleOAuthService,
    JwtAuthGuard,
  ],
  exports: [
    'PasswordHasher',
    'TokenService',
    'EmailService',
    JwtAuthGuard,
    JwtModule,
  ],
})
export class AuthModule { }
