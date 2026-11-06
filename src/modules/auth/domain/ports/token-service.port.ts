export interface AuthTokenPayload {
  sub: string;
  id: number;
  email: string;
  role: string;
  isOrganizer: boolean;
  emailVerified?: boolean;
}

export interface EmailVerificationTokenPayload {
  sub: string;
  email: string;
  type: 'email_verification';
}

export interface TokenService {
  generateToken(payload: AuthTokenPayload): string;
  verifyToken(token: string): AuthTokenPayload | null;
  generateEmailVerificationToken(payload: { sub: string; email: string }): string;
  verifyEmailVerificationToken(token: string): EmailVerificationTokenPayload | null;
  generateRefreshToken(payload: { userId: number; publicUuid: string }): Promise<string>;
  verifyAndRotateRefreshToken(refreshToken: string): Promise<{ userId: number; publicUuid: string } | null>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: number): Promise<void>;
}
