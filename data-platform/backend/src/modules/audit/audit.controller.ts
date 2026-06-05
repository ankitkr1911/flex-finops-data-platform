import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AzureAdGuard } from '../../auth/azure-ad.guard';
import { MultiTenantGuard } from '../../auth/multi-tenant.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(AzureAdGuard, MultiTenantGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  async getLogs(@Req() req: any, @Query('limit') limit: number = 100) {
    return this.service.getLogs(req.businessUnitId, limit);
  }

  @Get('bundle')
  async getHashBundle(@Req() req: any) {
    return this.service.getHashBundle(req.businessUnitId);
  }
}
