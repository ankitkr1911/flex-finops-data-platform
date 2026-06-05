import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { ChargebackModule } from './modules/chargeback/chargeback.module';
import { AnomaliesModule } from './modules/anomalies/anomalies.module';
import { SavingsModule } from './modules/savings/savings.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { KpisModule } from './modules/kpis/kpis.module';
import { AuditModule } from './modules/audit/audit.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    RedisModule,
    KpisModule,
    ChargebackModule,
    AnomaliesModule,
    SavingsModule,
    WorkforceModule,
    GovernanceModule,
    AuditModule,
    EventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
