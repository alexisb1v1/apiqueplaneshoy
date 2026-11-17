export class ApproveEventCommand {
  constructor(
    public readonly eventIdentifier: string,
    public readonly approvedBy?: string,
  ) {}
}
