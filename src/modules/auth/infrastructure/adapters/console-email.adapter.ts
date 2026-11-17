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

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    this.logger.log(`\n============================================================`);
    this.logger.log(`🔐 [EMAIL DE RECUPERACIÓN DE CONTRASEÑA]`);
    this.logger.log(`👤 Destinatario: ${name} <${to}>`);
    this.logger.log(`🔗 Enlace de restablecimiento (15 min): ${resetUrl}`);
    this.logger.log(`🔑 Token efímero de un solo uso: ${token}`);
    this.logger.log(`============================================================\n`);
  }

  async sendPasswordChangedNotificationEmail(to: string, name: string): Promise<void> {
    this.logger.log(`\n============================================================`);
    this.logger.log(`🛡️ [NOTIFICACIÓN DE SEGURIDAD]`);
    this.logger.log(`👤 Destinatario: ${name} <${to}>`);
    this.logger.log(`✅ Contraseña actualizada exitosamente para la cuenta`);
    this.logger.log(`⏰ Fecha: ${new Date().toISOString()}`);
    this.logger.log(`⚠️ Si no fuiste tú, contacta inmediatamente a soporte.`);
    this.logger.log(`============================================================\n`);
  }
}
