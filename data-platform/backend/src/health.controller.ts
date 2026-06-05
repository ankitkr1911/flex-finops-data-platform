import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'Flex Data Platform API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        kpis: '/api/v1/kpis',
        'kpis/trend': '/api/v1/kpis/trend',
        anomalies: '/api/v1/anomalies',
        savings: '/api/v1/savings',
        chargeback: '/api/v1/chargeback',
        workforce: '/api/v1/workforce/squads',
        governance: '/api/v1/governance/datasets',
        audit: '/api/v1/audit',
      },
    };
  }
}
