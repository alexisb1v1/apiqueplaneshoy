export class PublishEventCommand {
  constructor(
    public readonly publicUuid: string,
    public readonly eventIdentifier: string,
  ) {}
}

