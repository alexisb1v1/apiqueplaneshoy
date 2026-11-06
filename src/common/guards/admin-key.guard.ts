import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenService } from '@auth/domain/ports/token-service.port';

@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Validar por cabecera secreta x-admin-key
    const adminKeyHeader = request.headers['x-admin-key'];
    const configuredKey =
      this.configService.get<string>('ADMIN_API_KEY') || 'qph-admin-master-secret-key-2026';

    if (adminKeyHeader && adminKeyHeader === configuredKey) {
      return true;
    }

    // 2. Validar por token JWT con rol admin
    const authHeader = request.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = this.tokenService.verifyToken(token);
      if (payload && payload.role === 'admin') {
        return true;
      }
    }

    throw new ForbiddenException(
      'Acceso restringido exclusivamente a administradores. Proporciona la cabecera x-admin-key válida o un token JWT con rol admin.',
    );
  }
}

