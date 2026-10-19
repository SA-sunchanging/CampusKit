import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { RentalsController } from './rentals.controller.js';

@Module({
  imports: [BookingClientModule],
  controllers: [RentalsController],
})
export class RentalsModule {}
