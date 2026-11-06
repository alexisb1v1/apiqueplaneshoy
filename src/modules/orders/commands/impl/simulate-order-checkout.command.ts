import { SimulateOrderCheckoutRequestDto } from '../../dto/simulate-order-checkout.request.dto';

export class SimulateOrderCheckoutCommand {
  constructor(
    public readonly dto: SimulateOrderCheckoutRequestDto,
    public readonly authenticatedUserId?: number,
  ) {}
}

