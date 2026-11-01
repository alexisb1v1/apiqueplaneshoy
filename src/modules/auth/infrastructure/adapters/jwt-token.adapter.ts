import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  TokenService,
  AuthTokenPayload,
  EmailVerificationTokenPayload,
} from '@auth/domain/ports/token-service.port';

@Injectable()
export class JwtTokenAdapter implements TokenService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(payload: AuthTokenPayload): string {
    return this.jwtService.sign(payload);
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      return this.jwtService.verify<AuthTokenPayload>(token);
    } catch {
      return null;
    }
  }

  generateEmailVerificationToken(payload: { sub: string; email: string }): string {
    return this.jwtService.sign(
      {
        sub: payload.sub,
        email: payload.email,
        type: 'email_verification',
      },
      {
        expiresIn: '24h',
      },
    );
  }

  verifyEmailVerificationToken(token: string): EmailVerificationTokenPayload | null {
    try {
      const decoded = this.jwtService.verify<EmailVerificationTokenPayload>(token);
      if (decoded.type !== 'email_verification') {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }
}
