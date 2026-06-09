import { CreateEventDto } from '../../dto/create-event.dto';

export class CreateEventCommand {
  constructor(public readonly dto: CreateEventDto) {}
}
