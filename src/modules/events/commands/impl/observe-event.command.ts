export class ObserveEventCommand {
  constructor(
    public readonly eventIdentifier: string,
    public readonly reason?: string,
  ) {}
}

