export class GetEventLandingQuery {
  constructor(
    public readonly slug: string,
    public readonly skipCache: boolean = false,
  ) {}
}

