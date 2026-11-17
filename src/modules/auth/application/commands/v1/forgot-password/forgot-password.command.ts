import { ForgotPasswordRequestDto } from '@auth/interfaces/http/v1/forgot-password/dto/forgot-password.request.dto';

export class ForgotPasswordCommand {
  constructor(public readonly dto: ForgotPasswordRequestDto) {}
}

