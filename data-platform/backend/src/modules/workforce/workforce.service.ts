import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.module';

@Injectable()
export class WorkforceService {
  constructor(@Inject(DATABASE_POOL) private pool: Pool) {}

  async getSquads(businessUnitId: string) {
    const result = await this.pool.query(
      `SELECT * FROM flex.workforce WHERE business_unit_id = $1 ORDER BY cloud_cost_monthly DESC`,
      [businessUnitId],
    );
    return result.rows;
  }
}
