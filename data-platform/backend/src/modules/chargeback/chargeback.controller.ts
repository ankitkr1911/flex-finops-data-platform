import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AzureAdGuard } from '../../auth/azure-ad.guard';
import { MultiTenantGuard } from '../../auth/multi-tenant.guard';
import { ChargebackService } from './chargeback.service';

@Controller('chargeback')
@UseGuards(AzureAdGuard, MultiTenantGuard)
export class ChargebackController {
  constructor(private readonly service: ChargebackService) {}

  @Get()
  async getChargeback(@Req() req: any, @Query('period') period?: string) {
    return this.service.getByPeriod(req.businessUnitId, period);
  }

  @Get('summary')
  async getSummary(@Req() req: any) {
    return this.service.getSummary(req.businessUnitId);
  }
}
