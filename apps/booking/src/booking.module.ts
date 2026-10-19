import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, postgresOptions } from '@app/common';
import { BookingsModule } from './bookings/bookings.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { migrations } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('booking', migrations)),
    AuthModule,
    HealthModule.register('booking'),
    BookingsModule,
  ],
})
export class BookingModule {}
