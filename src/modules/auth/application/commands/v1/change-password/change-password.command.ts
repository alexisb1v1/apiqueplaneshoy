import { ChangePasswordRequestDto } from '@auth/interfaces/http/v1/change-password/dto/change-password.request.dto';

export class ChangePasswordCommand {
  constructor(
    public readonly publicUuid: string,
    public readonly dto: ChangePasswordRequestDto,
  ) {}
}

