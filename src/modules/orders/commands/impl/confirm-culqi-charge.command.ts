import { ConfirmCulqiChargeRequestDto } from '../../dto/confirm-culqi-charge.request.dto';

export class ConfirmCulqiChargeCommand {
  constructor(
    public readonly dto: ConfirmCulqiChargeRequestDto,
    public readonly authenticatedUserId: number,
  ) {}
}

