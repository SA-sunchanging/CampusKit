import { AuthModule } from '@app/common';
import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { InternalRentalsController } from '../internal/internal-rentals.controller.js';
import { RentalCreationService } from './rental-creation.service.js';
import { RentalQueriesService } from './rental-queries.service.js';
import { RentalsController } from './rentals.controller.js';

@Module({
  imports: [AuthModule, BookingClientModule],
  controllers: [RentalsController, InternalRentalsController],
  providers: [RentalCreationService, RentalQueriesService],
})
export class RentalsModule {}
