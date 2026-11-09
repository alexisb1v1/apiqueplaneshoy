export interface EmailService {
  sendVerificationEmail(to: string, name: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, name: string, token: string): Promise<void>;
  sendPasswordChangedNotificationEmail(to: string, name: string): Promise<void>;
}
