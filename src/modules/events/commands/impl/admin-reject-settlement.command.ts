import { AdminRejectSettlementRequestDto } from '../../dto/admin-reject-settlement.request.dto';

export class AdminRejectSettlementCommand {
  constructor(
    public readonly settlementIdentifier: string,
    public readonly dto: AdminRejectSettlementRequestDto,
    public readonly adminUserId: number | null,
  ) {}
}
