import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

const databaseProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new Pool({
      host: config.get('POSTGRES_HOST', 'localhost'),
      port: config.get('POSTGRES_PORT', 5432),
      database: config.get('POSTGRES_DB', 'flex_finops'),
      user: config.get('POSTGRES_USER', 'flex_admin'),
      password: config.get('POSTGRES_PASSWORD', 'flex_local_dev_2026'),
      max: 20,
      idleTimeoutMillis: 30000,
    });
  },
};

@Global()
@Module({
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}
