import { RequestEventSettlementRequestDto } from '../../dto/request-event-settlement.request.dto';

export class RequestEventSettlementCommand {
  constructor(
    public readonly publicUuid: string,
    public readonly eventIdentifier: string,
    public readonly dto: RequestEventSettlementRequestDto,
  ) {}
}
