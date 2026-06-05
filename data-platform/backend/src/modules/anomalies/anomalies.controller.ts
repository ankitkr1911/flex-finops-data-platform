import { Controller, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AzureAdGuard } from '../../auth/azure-ad.guard';
import { MultiTenantGuard } from '../../auth/multi-tenant.guard';
import { AnomaliesService } from './anomalies.service';

@Controller('anomalies')
@UseGuards(AzureAdGuard, MultiTenantGuard)
export class AnomaliesController {
  constructor(private readonly service: AnomaliesService) {}

  @Get()
  async getAll(@Req() req: any) {
    return this.service.getAll(req.businessUnitId);
  }

  @Get('open')
  async getOpen(@Req() req: any) {
    return this.service.getByStatus(req.businessUnitId, 'open');
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.service.updateStatus(req.businessUnitId, id, status);
  }
}
