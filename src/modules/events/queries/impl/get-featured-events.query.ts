export class GetFeaturedEventsQuery {
  constructor(
    public readonly limit: number = 5,
    public readonly skipCache: boolean = false,
  ) {}
}

