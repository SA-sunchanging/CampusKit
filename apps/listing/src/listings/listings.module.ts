import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller.js';

@Module({
  imports: [BookingClientModule],
  controllers: [ListingsController],
})
export class ListingsModule {}
