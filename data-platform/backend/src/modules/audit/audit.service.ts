import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { DATABASE_POOL } from '../../database/database.module';

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE_POOL) private pool: Pool) {}

  async log(
    businessUnitId: string,
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    payload: any = {},
  ) {
    // Get previous hash for chain
    const lastEntry = await this.pool.query(
      `SELECT hash FROM flex.audit_log WHERE business_unit_id = $1 ORDER BY id DESC LIMIT 1`,
      [businessUnitId],
    );
    const prevHash = lastEntry.rows[0]?.hash || '0'.repeat(64);

    // Compute current hash
    const hashInput = `${prevHash}:${action}:${entityType}:${entityId}:${JSON.stringify(payload)}:${Date.now()}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');

    await this.pool.query(
      `INSERT INTO flex.audit_log (business_unit_id, actor_id, action, entity_type, entity_id, payload, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [businessUnitId, actorId, action, entityType, entityId, JSON.stringify(payload), prevHash, hash],
    );
  }

  async getLogs(businessUnitId: string, limit: number) {
    return (await this.pool.query(
      `SELECT * FROM flex.audit_log WHERE business_unit_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [businessUnitId, limit],
    )).rows;
  }

  async getHashBundle(businessUnitId: string) {
    const logs = await this.pool.query(
      `SELECT id, hash, prev_hash, action, created_at FROM flex.audit_log WHERE business_unit_id = $1 ORDER BY id`,
      [businessUnitId],
    );

    // Verify chain integrity
    let valid = true;
    for (let i = 1; i < logs.rows.length; i++) {
      if (logs.rows[i].prev_hash !== logs.rows[i - 1].hash) {
        valid = false;
        break;
      }
    }

    return {
      total: logs.rows.length,
      chainValid: valid,
      latestHash: logs.rows[logs.rows.length - 1]?.hash || null,
      entries: logs.rows.slice(-10), // Last 10 for preview
    };
  }
}
