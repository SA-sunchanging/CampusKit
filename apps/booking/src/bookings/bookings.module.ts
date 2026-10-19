import { Module } from '@nestjs/common';
import { BookingsGrpcController } from './bookings.grpc-controller.js';

@Module({
  controllers: [BookingsGrpcController],
})
export class BookingsModule {}
