import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GrpcMethod } from '@nestjs/microservices';
import type { DateRange } from '../calendar/date-range.js';
import { callContextFrom } from '../clients/call-context.js';
import { callerFrom } from '../grpc-auth.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { BookingDecisionsService } from './booking-decisions.service.js';
import { type BookingReply, toBookingReply } from './booking.reply.js';
import { BookingsService } from './bookings.service.js';

interface RequestBookingRequest {
  listingId?: string;
  period?: DateRange;
}

interface BookingIdRequest {
  id?: string;
}

/** DeclineBookingRequest and CancelBookingRequest. */
interface BookingReasonRequest {
  id?: string;
  reason?: string;
}

interface ListBookingsRequest {
  role?: string;
  status?: string;
}

/**
 * Booking handlers of libs/contracts/proto/booking.proto; the calendar handlers live in calendar/.
 * Operations owned by Booking (see docs/architecture/services.md): request, approve, decline,
 * cancel, get and list bookings.
 */
@Controller()
export class BookingsGrpcController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly decisions: BookingDecisionsService,
    private readonly cancellation: BookingCancellationService,
    private readonly jwt: JwtService,
  ) {}

  @GrpcMethod('BookingService', 'CancelBooking')
  async cancelBooking(
    request: BookingReasonRequest,
    metadata: Metadata,
  ): Promise<BookingReply> {
    const caller = callerFrom(metadata, this.jwt);
    const booking = await this.cancellation.cancel(
      caller,
      request.id ?? '',
      request.reason,
      callContextFrom(metadata),
    );
    return toBookingReply(booking);
  }

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

  @GrpcMethod('BookingService', 'ApproveBooking')
  async approveBooking(
    request: BookingIdRequest,
    metadata: Metadata,
  ): Promise<BookingReply> {
    const caller = callerFrom(metadata, this.jwt);
    const booking = await this.decisions.approve(
      caller,
      request.id ?? '',
      callContextFrom(metadata),
    );
    return toBookingReply(booking);
  }

  @GrpcMethod('BookingService', 'DeclineBooking')
  async declineBooking(
    request: BookingReasonRequest,
    metadata: Metadata,
  ): Promise<BookingReply> {
    const caller = callerFrom(metadata, this.jwt);
    const booking = await this.decisions.decline(
      caller,
      request.id ?? '',
      request.reason,
      callContextFrom(metadata),
    );
    return toBookingReply(booking);
  }

  @GrpcMethod('BookingService', 'GetBooking')
  async getBooking(
    request: BookingIdRequest,
    metadata: Metadata,
  ): Promise<BookingReply> {
    const caller = callerFrom(metadata, this.jwt);
    const booking = await this.bookings.get(
      caller,
      request.id ?? '',
      callContextFrom(metadata),
    );
    return toBookingReply(booking);
  }

  @GrpcMethod('BookingService', 'ListBookings')
  async listBookings(
    request: ListBookingsRequest,
    metadata: Metadata,
  ): Promise<{ bookings: BookingReply[] }> {
    const caller = callerFrom(metadata, this.jwt);
    const rows = await this.bookings.list(
      caller,
      request.role,
      request.status,
      callContextFrom(metadata),
    );
    return { bookings: rows.map(toBookingReply) };
  }
}
