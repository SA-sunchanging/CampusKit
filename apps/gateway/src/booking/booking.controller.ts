import type { Metadata } from '@grpc/grpc-js';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingGrpcService } from './booking-grpc.service.js';
import { CallMetadata } from './grpc-metadata.js';

/** Translates client REST requests under /api/booking into Booking gRPC calls. Owner: Booking. */
@ApiTags('booking')
@ApiBearerAuth()
@Controller('api/booking')
export class BookingController {
  constructor(private readonly booking: BookingGrpcService) {}

  @Get('bookings/:id')
  getBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CallMetadata() metadata: Metadata,
  ): Promise<unknown> {
    return this.booking.getBooking(id, metadata);
  }
}
