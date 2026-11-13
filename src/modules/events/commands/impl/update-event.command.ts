import { UpdateEventDto } from '@events/dto/update-event.dto';

export class UpdateEventCommand {
  constructor(
    public readonly publicUuid: string,
    public readonly eventIdentifier: string,
    public readonly dto: UpdateEventDto,
  ) {}
}

