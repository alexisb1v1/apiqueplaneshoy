export class GetOrganizerEventForEditQuery {
  constructor(
    public readonly publicUuid: string,
    public readonly eventIdentifier: string,
  ) {}
}

