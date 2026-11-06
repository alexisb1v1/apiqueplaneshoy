import { ResendVerificationRequestDto } from '@auth/interfaces/http/v1/resend-verification/dto/resend-verification.request.dto';

export class ResendVerificationCommand {
  constructor(public readonly dto: ResendVerificationRequestDto) {}
}
