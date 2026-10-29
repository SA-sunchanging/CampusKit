import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { IdentityClient } from '../clients/identity.client.js';
import { ListingClient } from '../clients/listing.client.js';
import { PaymentClient } from '../clients/payment.client.js';
import { RentalClient } from '../clients/rental.client.js';
import { ApprovalSweeper } from './approval-sweeper.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { BookingDecisionsService } from './booking-decisions.service.js';
import { BookingsGrpcController } from './bookings.grpc-controller.js';
import { BookingsService } from './bookings.service.js';
import { Compensation } from './compensation.js';

@Module({
  imports: [AuthModule],
  controllers: [BookingsGrpcController],
  providers: [
    BookingsService,
    BookingDecisionsService,
    BookingCancellationService,
    Compensation,
    ApprovalSweeper,
    IdentityClient,
    ListingClient,
    PaymentClient,
    RentalClient,
  ],
})
export class BookingsModule {}
