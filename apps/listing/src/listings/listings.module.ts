import { AuthModule } from '@app/common';
import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarClient } from '../clients/calendar.client.js';
import { IdentityClient } from '../clients/identity.client.js';
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
  controllers: [ListingsController],
  providers: [ListingsService, IdentityClient, CalendarClient],
  exports: [ListingsService],
})
export class ListingsModule {}
