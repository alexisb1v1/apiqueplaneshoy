import { CreateIzipayPaymentRequestDto } from '../../dto/create-izipay-payment.request.dto';

export class CreateIzipayPaymentCommand {
  constructor(
    public readonly dto: CreateIzipayPaymentRequestDto,
    public readonly authenticatedUserId: number,
  ) {}
}

