import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

/**
 * Scheduled Tasks
 * In production these would be Databricks Jobs + EventBridge scheduled rules.
 * Locally they run via node-cron in NestJS.
 */
@Injectable()
export class ScheduledTasks {
  private readonly logger = new Logger(ScheduledTasks.name);

  constructor(
    @Inject(DATABASE_POOL) private pool: Pool,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  // Refresh KPI cache every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshKpiCache() {
    this.logger.log('Refreshing KPI cache...');
    const result = await this.pool.query(
      `SELECT business_unit_id, period, total_spend, spend_change_pct, active_resources
       FROM flex.kpis ORDER BY period DESC`,
    );

    for (const row of result.rows) {
      const key = `kpis:${row.business_unit_id}:latest`;
      await this.redis.setex(key, 300, JSON.stringify(row));
    }
    this.logger.log(`KPI cache refreshed: ${result.rows.length} entries`);
  }

  // Process unhandled events every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async processEvents() {
    const result = await this.pool.query(
      `SELECT * FROM flex.events WHERE processed = false ORDER BY emitted_at LIMIT 50`,
    );

    if (result.rows.length === 0) return;

    this.logger.log(`Processing ${result.rows.length} pending events...`);
    const ids = result.rows.map((r: any) => r.id);
    await this.pool.query(
      `UPDATE flex.events SET processed = true WHERE id = ANY($1)`,
      [ids],
    );
  }
}
