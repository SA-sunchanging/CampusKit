import { AuthModule } from '@app/common';
import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarClient } from '../clients/calendar.client.js';
import { IdentityClient } from '../clients/identity.client.js';
import { InternalListingsController } from '../internal/internal-listings.controller.js';
import { ListingQueriesService } from './listing-queries.service.js';
import { ListingPhoto } from './listing-photo.entity.js';
import { Listing } from './listing.entity.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [
    AuthModule,
    BookingClientModule,
    TypeOrmModule.forFeature([Listing, ListingPhoto]),
  ],
  controllers: [ListingsController, InternalListingsController],
  providers: [
    ListingsService,
    ListingQueriesService,
    IdentityClient,
    CalendarClient,
  ],
  exports: [ListingsService],
})
export class ListingsModule {}
