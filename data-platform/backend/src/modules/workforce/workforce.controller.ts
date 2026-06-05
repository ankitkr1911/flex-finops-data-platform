import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AzureAdGuard } from '../../auth/azure-ad.guard';
import { MultiTenantGuard } from '../../auth/multi-tenant.guard';
import { WorkforceService } from './workforce.service';

@Controller('workforce')
@UseGuards(AzureAdGuard, MultiTenantGuard)
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  @Get('squads')
  async getSquads(@Req() req: any) {
    return this.service.getSquads(req.businessUnitId);
  }
}
