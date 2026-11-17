export class CancelPendingCulqiOrderCommand {
  constructor(
    public readonly orderPublicUuid: string,
    public readonly authenticatedUserId: number,
  ) {}
}

