export class GetEventSettlementQuery {
  constructor(
    public readonly publicUuid: string,
    public readonly eventIdentifier: string,
  ) {}
}
