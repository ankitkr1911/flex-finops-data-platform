import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.module';
import { REDIS_CLIENT } from '../../redis/redis.module';
import Redis from 'ioredis';

@Injectable()
export class KpisService {
  constructor(
    @Inject(DATABASE_POOL) private pool: Pool,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async getKpis(businessUnitId: string, period?: string) {
    // Check Redis cache first
    const cacheKey = `kpis:${businessUnitId}:${period || 'latest'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const query = period
      ? `SELECT * FROM flex.kpis WHERE business_unit_id = $1 AND period = $2 ORDER BY computed_at DESC LIMIT 1`
      : `SELECT * FROM flex.kpis WHERE business_unit_id = $1 ORDER BY period DESC LIMIT 1`;

    const params = period ? [businessUnitId, period] : [businessUnitId];
    const result = await this.pool.query(query, params);

    if (result.rows.length > 0) {
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(result.rows[0]));
    }

    return result.rows[0] || null;
  }

  async getKpiTrend(businessUnitId: string, months: number) {
    const result = await this.pool.query(
      `SELECT * FROM flex.kpis WHERE business_unit_id = $1 ORDER BY period DESC LIMIT $2`,
      [businessUnitId, months],
    );
    return result.rows;
  }
}
