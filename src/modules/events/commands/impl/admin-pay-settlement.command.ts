import { AdminPaySettlementRequestDto } from '../../dto/admin-pay-settlement.request.dto';

export class AdminPaySettlementCommand {
  constructor(
    public readonly settlementIdentifier: string,
    public readonly dto: AdminPaySettlementRequestDto,
    public readonly adminUserId: number,
  ) {}
}
