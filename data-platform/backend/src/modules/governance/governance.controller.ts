import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AzureAdGuard } from '../../auth/azure-ad.guard';
import { MultiTenantGuard } from '../../auth/multi-tenant.guard';
import { GovernanceService } from './governance.service';

@Controller('governance')
@UseGuards(AzureAdGuard, MultiTenantGuard)
export class GovernanceController {
  constructor(private readonly service: GovernanceService) {}

  @Get('datasets')
  async getDatasets(@Req() req: any) {
    return this.service.getDatasets(req.businessUnitId);
  }

  @Get('requests')
  async getRequests(@Req() req: any) {
    return this.service.getDataRequests(req.businessUnitId);
  }

  @Post('requests')
  async createRequest(@Req() req: any, @Body() body: any) {
    return this.service.createDataRequest(req.businessUnitId, req.user.oid, body);
  }

  @Patch('requests/:id/approve')
  async approveRequest(@Req() req: any, @Param('id') id: string) {
    return this.service.approveRequest(req.businessUnitId, id, req.user.oid);
  }

  @Patch('requests/:id/reject')
  async rejectRequest(@Req() req: any, @Param('id') id: string) {
    return this.service.rejectRequest(req.businessUnitId, id, req.user.oid);
  }

  @Get('tag-rules')
  async getTagRules(@Req() req: any) {
    return this.service.getTagRules(req.businessUnitId);
  }
}
