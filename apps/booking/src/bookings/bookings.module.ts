import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module.js';
import { BookingsGrpcController } from './bookings.grpc-controller.js';

@Module({
  imports: [AuthModule, CalendarModule],
  controllers: [BookingsGrpcController],
})
export class BookingsModule {}
