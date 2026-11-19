export class ListAdminSettlementsQuery {
  constructor(
    public readonly status?: string,
    public readonly search?: string,
  ) {}
}
