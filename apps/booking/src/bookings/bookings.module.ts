import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { IdentityClient } from '../clients/identity.client.js';
import { ListingClient } from '../clients/listing.client.js';
import { BookingsGrpcController } from './bookings.grpc-controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BookingsGrpcController],
  providers: [BookingsService, IdentityClient, ListingClient],
})
export class BookingsModule {}
