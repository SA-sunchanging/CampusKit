import { AuthModule } from '@app/common';
import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationController } from '../admin/moderation.controller.js';
import { ModerationService } from '../admin/moderation.service.js';
import { CalendarClient } from '../clients/calendar.client.js';
import { IdentityClient } from '../clients/identity.client.js';
import { ReviewClient } from '../clients/review.client.js';
import { InternalListingsController } from '../internal/internal-listings.controller.js';
import { ListingQueriesService } from './listing-queries.service.js';
import { ListingSearchService } from './listing-search.service.js';
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
  controllers: [
    ListingsController,
    InternalListingsController,
    ModerationController,
  ],
  providers: [
    ListingsService,
    ListingQueriesService,
    ListingSearchService,
    ModerationService,
    IdentityClient,
    CalendarClient,
    ReviewClient,
  ],
  exports: [ListingsService],
})
export class ListingsModule {}
