import { VerifyEmailRequestDto } from '@auth/interfaces/http/v1/verify-email/dto/verify-email.request.dto';

export class VerifyEmailCommand {
  constructor(public readonly dto: VerifyEmailRequestDto) {}
}
