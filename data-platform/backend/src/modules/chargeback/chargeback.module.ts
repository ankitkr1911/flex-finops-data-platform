import { Module } from '@nestjs/common';
import { ChargebackController } from './chargeback.controller';
import { ChargebackService } from './chargeback.service';

@Module({
  controllers: [ChargebackController],
  providers: [ChargebackService],
})
export class ChargebackModule {}
