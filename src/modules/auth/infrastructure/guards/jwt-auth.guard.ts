import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '@auth/domain/ports/token-service.port';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    id: number;
    email: string;
    role: string;
    isOrganizer: boolean;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject('TokenService')
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación no proporcionado o inválido');
    }

    const token = authHeader.split(' ')[1];
    const payload = this.tokenService.verifyToken(token);

    if (!payload) {
      throw new UnauthorizedException('Token expirado o inválido');
    }

    request.user = payload;
    return true;
  }
}
