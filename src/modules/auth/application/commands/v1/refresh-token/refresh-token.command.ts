import { RefreshTokenRequestDto } from '@auth/interfaces/http/v1/refresh-token/dto/refresh-token.request.dto';

export class RefreshTokenCommand {
  constructor(public readonly dto: RefreshTokenRequestDto) {}
}

