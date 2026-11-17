export class GetCulqiOrderStatusQuery {
  constructor(
    public readonly orderPublicUuid: string,
    public readonly authenticatedUserId: number,
  ) {}
}

