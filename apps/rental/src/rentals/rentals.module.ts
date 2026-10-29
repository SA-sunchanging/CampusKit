import { AuthModule } from '@app/common';
import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { BookingClient } from '../clients/booking.client.js';
import { PaymentClient } from '../clients/payment.client.js';
import { InternalRentalsController } from '../internal/internal-rentals.controller.js';
import { PickupService } from './pickup.service.js';
import { RentalCancellationService } from './rental-cancellation.service.js';
import { RentalCreationService } from './rental-creation.service.js';
import { RentalQueriesService } from './rental-queries.service.js';
import { RentalsController } from './rentals.controller.js';
import { ReturnService } from './return.service.js';

@Module({
  imports: [AuthModule, BookingClientModule],
  controllers: [RentalsController, InternalRentalsController],
  providers: [
    RentalCreationService,
    RentalCancellationService,
    RentalQueriesService,
    BookingClient,
    PaymentClient,
    PickupService,
    ReturnService,
  ],
})
export class RentalsModule {}
