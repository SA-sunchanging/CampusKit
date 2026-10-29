import { BookingClientModule } from '@app/contracts';
import { Module } from '@nestjs/common';
import { BookingGrpcService } from './booking-grpc.service.js';
import { BookingController } from './booking.controller.js';

@Module({
  imports: [BookingClientModule],
  controllers: [BookingController],
  providers: [BookingGrpcService],
})
export class BookingModule {}
