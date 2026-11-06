import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@auth/domain/ports/email-service.port';

@Injectable()
export class ConsoleEmailAdapter implements EmailService {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    this.logger.log(`\n============================================================`);
    this.logger.log(`📧 [EMAIL DE VERIFICACIÓN] Para: ${name} <${to}>`);
    this.logger.log(`🔗 Enlace de confirmación: ${verificationUrl}`);
    this.logger.log(`🎟️ Token de 24h: ${token}`);
    this.logger.log(`============================================================\n`);
  }
}
