export class GetEventDetailQuery {
  constructor(
    public readonly identifier: string,
    public readonly skipCache: boolean = false,
  ) {}
}

