import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.module';

@Injectable()
export class ChargebackService {
  constructor(@Inject(DATABASE_POOL) private pool: Pool) {}

  async getByPeriod(businessUnitId: string, period?: string) {
    const query = period
      ? `SELECT * FROM flex.chargeback WHERE business_unit_id = $1 AND period = $2 ORDER BY monthly_spend DESC`
      : `SELECT * FROM flex.chargeback WHERE business_unit_id = $1 ORDER BY period DESC, monthly_spend DESC LIMIT 50`;

    const params = period ? [businessUnitId, period] : [businessUnitId];
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getSummary(businessUnitId: string) {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as team_count,
        SUM(monthly_spend) as total_spend,
        SUM(budget) as total_budget,
        AVG(tag_compliance_pct) as avg_tag_compliance,
        AVG(cost_per_engineer) as avg_cost_per_engineer
      FROM flex.chargeback 
      WHERE business_unit_id = $1 
        AND period = (SELECT MAX(period) FROM flex.chargeback WHERE business_unit_id = $1)`,
      [businessUnitId],
    );
    return result.rows[0];
  }
}
