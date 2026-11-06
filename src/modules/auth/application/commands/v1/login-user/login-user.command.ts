import { LoginUserRequestDto } from '@auth/interfaces/http/v1/login-user/dto/login-user.request.dto';

export class LoginUserCommand {
  constructor(public readonly dto: LoginUserRequestDto) {}
}
