import { PrepareCulqiCheckoutRequestDto } from '../../dto/prepare-culqi-checkout.request.dto';

export class PrepareCulqiCheckoutCommand {
  constructor(
    public readonly dto: PrepareCulqiCheckoutRequestDto,
    public readonly authenticatedUserId: number,
  ) {}
}

