import { Metadata, status } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GrpcMethod } from '@nestjs/microservices';
import type { DateRange } from '../calendar/date-range.js';
import { callContextFrom } from '../clients/call-context.js';
import { rpcError } from '../errors.js';
import { callerFrom } from '../grpc-auth.js';
import { type BookingReply, toBookingReply } from './booking.reply.js';
import { BookingsService } from './bookings.service.js';

interface RequestBookingRequest {
  listingId?: string;
  period?: DateRange;
}

/**
 * Booking handlers of libs/contracts/proto/booking.proto; the calendar handlers live in calendar/.
 * Operations owned by Booking (see docs/architecture/services.md): request, approve, decline,
 * get and list bookings.
 */
@Controller()
export class BookingsGrpcController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly jwt: JwtService,
  ) {}

  @GrpcMethod('BookingService', 'RequestBooking')
  async requestBooking(
    request: RequestBookingRequest,
    metadata: Metadata,
  ): Promise<BookingReply> {
    const caller = callerFrom(metadata, this.jwt);
    const booking = await this.bookings.request(
      caller,
      request.listingId ?? '',
      request.period,
      callContextFrom(metadata),
    );
    return toBookingReply(booking);
  }

  @GrpcMethod('BookingService', 'GetBooking')
  getBooking(): never {
    throw rpcError(status.UNIMPLEMENTED, 'GetBooking is not implemented yet');
  }
}
