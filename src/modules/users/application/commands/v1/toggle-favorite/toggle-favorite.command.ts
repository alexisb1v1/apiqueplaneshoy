export class ToggleFavoriteCommand {
  constructor(
    public readonly userId: number,
    public readonly eventId: string,
  ) {}
}

