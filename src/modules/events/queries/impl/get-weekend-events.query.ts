export class GetWeekendEventsQuery {
  constructor(
    public readonly limit: number = 8,
    public readonly skipCache: boolean = false,
  ) {}
}

