import { AuthModule, postgresOptions } from '@app/common';
import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarClient } from '../clients/calendar.client.js';
import { migrations } from '../migrations/index.js';

/** Only what the seed needs: the database (migrations run first), Booking, and token signing. */
@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('listing', migrations)),
    AuthModule,
    BookingClientModule,
  ],
  providers: [CalendarClient],
})
export class SeedModule {}
