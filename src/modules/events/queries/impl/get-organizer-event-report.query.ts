export class GetOrganizerEventReportQuery {
  constructor(
    public readonly publicUuid: string,
    public readonly eventIdentifier: string,
  ) {}
}
