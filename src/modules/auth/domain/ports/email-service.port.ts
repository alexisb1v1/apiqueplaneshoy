export interface EmailService {
  sendVerificationEmail(to: string, name: string, token: string): Promise<void>;
}
