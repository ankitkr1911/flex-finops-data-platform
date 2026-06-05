import { Module } from '@nestjs/common';
import { AzureAdGuard } from './azure-ad.guard';
import { MultiTenantGuard } from './multi-tenant.guard';

@Module({
  providers: [AzureAdGuard, MultiTenantGuard],
  exports: [AzureAdGuard, MultiTenantGuard],
})
export class AuthModule {}
