import { GoogleCallbackRequestDto } from '@auth/interfaces/http/v1/google-auth/dto/google-callback.request.dto';

export class GoogleCallbackCommand {
  constructor(public readonly dto: GoogleCallbackRequestDto) {}
}

