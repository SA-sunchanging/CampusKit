import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, postgresOptions } from '@app/common';
import { OutboxModule } from '@app/messaging';
import { BookingsModule } from './bookings/bookings.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { migrations } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('booking', migrations)),
    AuthModule,
    HealthModule.register('booking'),
    CalendarModule,
    BookingsModule,
    OutboxModule,
  ],
})
export class BookingModule {}
