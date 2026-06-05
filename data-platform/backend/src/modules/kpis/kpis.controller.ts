import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AzureAdGuard } from '../../auth/azure-ad.guard';
import { MultiTenantGuard } from '../../auth/multi-tenant.guard';
import { KpisService } from './kpis.service';

@Controller('kpis')
@UseGuards(AzureAdGuard, MultiTenantGuard)
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get()
  async getKpis(@Req() req: any, @Query('period') period?: string) {
    return this.kpisService.getKpis(req.businessUnitId, period);
  }

  @Get('trend')
  async getKpiTrend(@Req() req: any, @Query('months') months: number = 6) {
    return this.kpisService.getKpiTrend(req.businessUnitId, months);
  }
}
