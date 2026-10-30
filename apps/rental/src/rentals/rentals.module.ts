import { AuthModule } from '@app/common';
import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { BookingClient } from '../clients/booking.client.js';
import { PaymentClient } from '../clients/payment.client.js';
import { EvidenceController } from '../evidence/evidence.controller.js';
import { EvidenceService } from '../evidence/evidence.service.js';
import { InternalRentalsController } from '../internal/internal-rentals.controller.js';
import { PickupService } from './pickup.service.js';
import { RentalCancellationService } from './rental-cancellation.service.js';
import { RentalCreationService } from './rental-creation.service.js';
import { RentalQueriesService } from './rental-queries.service.js';
import { RentalSweeper } from './rental-sweeper.js';
import { RentalsController } from './rentals.controller.js';
import { ReturnService } from './return.service.js';

@Module({
  imports: [AuthModule, BookingClientModule],
  controllers: [
    RentalsController,
    EvidenceController,
    InternalRentalsController,
  ],
  providers: [
    RentalCreationService,
    RentalCancellationService,
    RentalQueriesService,
    BookingClient,
    PaymentClient,
    PickupService,
    ReturnService,
    RentalSweeper,
    EvidenceService,
  ],
})
export class RentalsModule {}
