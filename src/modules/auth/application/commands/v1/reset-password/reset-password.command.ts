import { ResetPasswordRequestDto } from '@auth/interfaces/http/v1/reset-password/dto/reset-password.request.dto';

export class ResetPasswordCommand {
  constructor(public readonly dto: ResetPasswordRequestDto) {}
}

