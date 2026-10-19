import { AuthModule, HealthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { BookingModule } from './booking/booking.module.js';

@Module({
  imports: [AuthModule, HealthModule.register('gateway'), BookingModule],
})
export class GatewayModule {}
