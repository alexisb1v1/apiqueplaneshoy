export class GetOrganizerEventsQuery {
  constructor(
    public readonly publicUuid: string,
    public readonly status?: string,
    public readonly search?: string,
  ) {}
}

