import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DATABASE_POOL } from '../../database/database.module';

@Injectable()
export class AnomaliesService {
  constructor(
    @Inject(DATABASE_POOL) private pool: Pool,
    private eventEmitter: EventEmitter2,
  ) {}

  async getAll(businessUnitId: string) {
    const result = await this.pool.query(
      `SELECT * FROM flex.anomalies WHERE business_unit_id = $1 ORDER BY detected_at DESC`,
      [businessUnitId],
    );
    return result.rows;
  }

  async getByStatus(businessUnitId: string, status: string) {
    const result = await this.pool.query(
      `SELECT * FROM flex.anomalies WHERE business_unit_id = $1 AND status = $2 ORDER BY detected_at DESC`,
      [businessUnitId, status],
    );
    return result.rows;
  }

  async updateStatus(businessUnitId: string, id: string, status: string) {
    const result = await this.pool.query(
      `UPDATE flex.anomalies SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
       WHERE id = $2 AND business_unit_id = $3 RETURNING *`,
      [status, id, businessUnitId],
    );

    if (result.rows[0] && status === 'resolved') {
      this.eventEmitter.emit('anomaly.resolved', {
        anomalyId: id,
        businessUnitId,
        title: result.rows[0].title,
      });
    }

    return result.rows[0];
  }
}
