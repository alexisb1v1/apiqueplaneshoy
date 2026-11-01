import { BecomeOrganizerRequestDto } from '@auth/interfaces/http/v1/become-organizer/dto/become-organizer.request.dto';

export class BecomeOrganizerCommand {
  constructor(
    public readonly publicUuid: string,
    public readonly dto: BecomeOrganizerRequestDto,
  ) {}
}

