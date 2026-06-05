import { Controller, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AzureAdGuard } from '../../auth/azure-ad.guard';
import { MultiTenantGuard } from '../../auth/multi-tenant.guard';
import { SavingsService } from './savings.service';

@Controller('savings')
@UseGuards(AzureAdGuard, MultiTenantGuard)
export class SavingsController {
  constructor(private readonly service: SavingsService) {}

  @Get()
  async getAll(@Req() req: any, @Query('stage') stage?: string) {
    return this.service.getAll(req.businessUnitId, stage);
  }

  @Patch(':id/stage')
  async updateStage(@Req() req: any, @Param('id') id: string, @Body('stage') stage: string) {
    return this.service.updateStage(req.businessUnitId, id, stage);
  }
}
