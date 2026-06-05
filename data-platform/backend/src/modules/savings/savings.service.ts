import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.module';

@Injectable()
export class SavingsService {
  constructor(@Inject(DATABASE_POOL) private pool: Pool) {}

  async getAll(businessUnitId: string, stage?: string) {
    const query = stage
      ? `SELECT * FROM flex.savings WHERE business_unit_id = $1 AND stage = $2 ORDER BY monthly_savings DESC`
      : `SELECT * FROM flex.savings WHERE business_unit_id = $1 ORDER BY monthly_savings DESC`;
    const params = stage ? [businessUnitId, stage] : [businessUnitId];
    return (await this.pool.query(query, params)).rows;
  }

  async updateStage(businessUnitId: string, id: string, stage: string) {
    const result = await this.pool.query(
      `UPDATE flex.savings SET stage = $1, updated_at = NOW() WHERE id = $2 AND business_unit_id = $3 RETURNING *`,
      [stage, id, businessUnitId],
    );
    return result.rows[0];
  }
}
