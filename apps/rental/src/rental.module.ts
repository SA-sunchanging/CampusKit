import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, postgresOptions } from '@app/common';
import { OutboxModule } from '@app/messaging';
import { RentalsModule } from './rentals/rentals.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { migrations } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('rental', migrations)),
    AuthModule,
    HealthModule.register('rental'),
    RentalsModule,
    OutboxModule,
  ],
})
export class RentalModule {}
