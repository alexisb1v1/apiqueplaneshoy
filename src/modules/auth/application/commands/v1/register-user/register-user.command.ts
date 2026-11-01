import { RegisterUserRequestDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.request.dto';

export class RegisterUserCommand {
  constructor(public readonly dto: RegisterUserRequestDto) {}
}
