import { Module } from '@nestjs/common';
import { EventHandlers } from './event.handlers';
import { AuditModule } from '../modules/audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [EventHandlers],
})
export class EventsModule {}
