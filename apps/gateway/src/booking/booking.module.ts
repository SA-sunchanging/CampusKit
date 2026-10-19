import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller.js';

@Module({
  imports: [BookingClientModule],
  controllers: [BookingController],
})
export class BookingModule {}
