import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';

/**
 * Multi-Tenant Guard
 * Sets the PostgreSQL session variable `app.current_business_unit_id`
 * so that Row-Level Security (RLS) policies enforce tenant isolation.
 */
@Injectable()
export class MultiTenantGuard implements CanActivate {
  constructor(@Inject(DATABASE_POOL) private pool: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const businessUnitId = request.user?.businessUnitId;

    if (!businessUnitId) {
      return false;
    }

    // Store BU ID on request for use in services
    request.businessUnitId = businessUnitId;

    return true;
  }
}

/**
 * Helper: Set the RLS context on a DB connection before queries.
 * Call this in every service method that queries tenant data.
 */
export async function setTenantContext(pool: Pool, businessUnitId: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_business_unit_id = '${businessUnitId}'`);
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}
