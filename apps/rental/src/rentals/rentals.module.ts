import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { InternalRentalsController } from '../internal/internal-rentals.controller.js';
import { RentalCreationService } from './rental-creation.service.js';
import { RentalsController } from './rentals.controller.js';

@Module({
  imports: [BookingClientModule],
  controllers: [RentalsController, InternalRentalsController],
  providers: [RentalCreationService],
})
export class RentalsModule {}
