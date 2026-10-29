import { BOOKING_CLIENT } from '@app/contracts';
import type { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable, timeout } from 'rxjs';
import type { BookingRole, BookingStatus } from './booking-status.js';
import {
  toAvailabilityResponse,
  toBookingListResponse,
  toBookingResponse,
} from './booking.mapper.js';
import type {
  BookingReply,
  CheckAvailabilityReply,
  ListBookingsReply,
} from './booking.reply.js';
import type {
  AvailabilityResponse,
  BookingListResponse,
  BookingResponse,
} from './booking.response.js';
import { toHttpError } from './grpc-error.js';

/**
 * Booking answers within this time, or the gateway answers 504. An approval makes up to four
 * calls of at most 5 s each (authorize the fee and the deposit, create the rental, void the
 * holds after a refusal), so this leaves room for those and the database.
 */
export const BOOKING_TIMEOUT_MS = 25_000;

interface Period {
  start: string;
  end: string;
}

/** Methods of BookingService in libs/contracts/proto/booking.proto that the gateway calls. */
interface BookingService {
  requestBooking(
    request: { listingId: string; period: Period },
    metadata: Metadata,
  ): Observable<BookingReply>;
  approveBooking(
    request: { id: string },
    metadata: Metadata,
  ): Observable<BookingReply>;
  declineBooking(
    request: { id: string; reason: string },
    metadata: Metadata,
  ): Observable<BookingReply>;
  getBooking(
    request: { id: string },
    metadata: Metadata,
  ): Observable<BookingReply>;
  listBookings(
    request: { role: string; status: string },
    metadata: Metadata,
  ): Observable<ListBookingsReply>;
  checkAvailability(
    request: { listingId: string; period: Period },
    metadata: Metadata,
  ): Observable<CheckAvailabilityReply>;
}

/** Calls Booking over gRPC as the caller, with a timeout, and turns gRPC errors into HTTP errors. */
@Injectable()
export class BookingGrpcService implements OnModuleInit {
  private booking: BookingService;

  constructor(@Inject(BOOKING_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.booking = this.client.getService<BookingService>('BookingService');
  }

  async requestBooking(
    listingId: string,
    period: Period,
    metadata: Metadata,
  ): Promise<BookingResponse> {
    const { start, end } = period;
    const request = { listingId, period: { start, end } };
    const reply = await call(this.booking.requestBooking(request, metadata));
    return toBookingResponse(reply);
  }

  async approveBooking(
    id: string,
    metadata: Metadata,
  ): Promise<BookingResponse> {
    const reply = await call(this.booking.approveBooking({ id }, metadata));
    return toBookingResponse(reply);
  }

  async declineBooking(
    id: string,
    reason: string | undefined,
    metadata: Metadata,
  ): Promise<BookingResponse> {
    const request = { id, reason: reason ?? '' };
    const reply = await call(this.booking.declineBooking(request, metadata));
    return toBookingResponse(reply);
  }

  async getBooking(id: string, metadata: Metadata): Promise<BookingResponse> {
    const reply = await call(this.booking.getBooking({ id }, metadata));
    return toBookingResponse(reply);
  }

  async listBookings(
    role: BookingRole,
    status: BookingStatus | undefined,
    metadata: Metadata,
  ): Promise<BookingListResponse> {
    const request = { role, status: status ?? '' };
    const reply = await call(this.booking.listBookings(request, metadata));
    return toBookingListResponse(reply);
  }

  async checkAvailability(
    listingId: string,
    period: Period,
    metadata: Metadata,
  ): Promise<AvailabilityResponse> {
    const { start, end } = period;
    const request = { listingId, period: { start, end } };
    const reply = await call(this.booking.checkAvailability(request, metadata));
    return toAvailabilityResponse(reply);
  }
}

async function call<T>(reply: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(reply.pipe(timeout(BOOKING_TIMEOUT_MS)));
  } catch (error) {
    throw toHttpError(error);
  }
}
