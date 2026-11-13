export class GetOrganizerEventsQuery {
  constructor(
    public readonly publicUuid: string,
    public readonly status?: string,
    public readonly search?: string,
    public readonly period?: '3m' | '6m' | '12m' | 'all',
  ) {}
}

