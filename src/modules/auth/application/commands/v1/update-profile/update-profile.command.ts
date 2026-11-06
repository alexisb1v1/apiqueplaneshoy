import { UpdateProfileRequestDto } from '@auth/interfaces/http/v1/update-profile/dto/update-profile.request.dto';

export class UpdateProfileCommand {
  constructor(
    public readonly publicUuid: string,
    public readonly dto: UpdateProfileRequestDto,
  ) {}
}

