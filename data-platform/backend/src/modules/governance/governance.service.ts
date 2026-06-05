import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DATABASE_POOL } from '../../database/database.module';

@Injectable()
export class GovernanceService {
  constructor(
    @Inject(DATABASE_POOL) private pool: Pool,
    private eventEmitter: EventEmitter2,
  ) {}

  async getDatasets(businessUnitId: string) {
    return (await this.pool.query(
      `SELECT * FROM flex.published_datasets WHERE business_unit_id = $1 ORDER BY last_published DESC`,
      [businessUnitId],
    )).rows;
  }

  async getDataRequests(businessUnitId: string) {
    return (await this.pool.query(
      `SELECT * FROM flex.data_requests WHERE business_unit_id = $1 ORDER BY requested_at DESC`,
      [businessUnitId],
    )).rows;
  }

  async createDataRequest(businessUnitId: string, userId: string, body: any) {
    const result = await this.pool.query(
      `INSERT INTO flex.data_requests (business_unit_id, from_app, dataset, purpose, record_count, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [businessUnitId, body.fromApp, body.dataset, body.purpose, body.recordCount || 0, userId],
    );
    this.eventEmitter.emit('exchange.requested', { request: result.rows[0], businessUnitId });
    return result.rows[0];
  }

  async approveRequest(businessUnitId: string, id: string, decidedBy: string) {
    const result = await this.pool.query(
      `UPDATE flex.data_requests SET status = 'approved', decided_at = NOW(), decided_by = $1
       WHERE id = $2 AND business_unit_id = $3 RETURNING *`,
      [decidedBy, id, businessUnitId],
    );
    this.eventEmitter.emit('exchange.approved', { request: result.rows[0], businessUnitId });
    return result.rows[0];
  }

  async rejectRequest(businessUnitId: string, id: string, decidedBy: string) {
    const result = await this.pool.query(
      `UPDATE flex.data_requests SET status = 'rejected', decided_at = NOW(), decided_by = $1
       WHERE id = $2 AND business_unit_id = $3 RETURNING *`,
      [decidedBy, id, businessUnitId],
    );
    return result.rows[0];
  }

  async getTagRules(businessUnitId: string) {
    return (await this.pool.query(
      `SELECT * FROM flex.tag_rules WHERE business_unit_id = $1`,
      [businessUnitId],
    )).rows;
  }
}
