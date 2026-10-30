import { SERVICE_TOKEN_HEADER } from '@app/common';
import { BOOKING_CLIENT } from '@app/contracts';
import { Metadata, status } from '@grpc/grpc-js';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable, timeout } from 'rxjs';
import type { CallContext } from './call-context.js';
import type { ServiceFailure, ServiceResult } from './http-call.js';
import { serviceTokens } from './service-token.js';

/** Booking answers within this time or counts as unavailable. */
export const TIMEOUT_MS = 5_000;

/** The fields of a Booking message (libs/contracts/proto/booking.proto) that Rental reads. */
export interface BookingView {
  id: string;
  listingId: string;
  renterId: string;
  ownerId: string;
  /** PENDING, AUTHORIZING, CONFIRMED, DECLINED, EXPIRED or CANCELLED. */
  status: string;
  /** ISO-8601 UTC, half-open [start, end). */
  period: { start: string; end: string };
  /** Integer satang. */
  terms: { rentalFee: number; deposit: number; lateFeePerDay: number };
}

/** The BookingService methods that Rental calls. */
interface BookingRpc {
  getBooking(request: { id: string }, metadata: Metadata): Observable<unknown>;
  releaseCalendar(
    request: { bookingId: string },
    metadata: Metadata,
  ): Observable<unknown>;
}

/** Status codes that mean Booking refused the call for good; anything else may pass on a retry. */
const DECLINED_CODES: readonly number[] = [
  status.NOT_FOUND,
  status.PERMISSION_DENIED,
  status.FAILED_PRECONDITION,
  status.INVALID_ARGUMENT,
];

/** Classifies a gRPC error (or a timeout, which has no code) as declined or unavailable. */
export function bookingFailure(error: unknown): ServiceFailure {
  const { code, details } = (error ?? {}) as {
    code?: number;
    details?: string;
  };
  if (code !== undefined && DECLINED_CODES.includes(code)) {
    return {
      ok: false,
      reason: 'declined',
      message: details || 'The booking service refused the request',
    };
  }
  return {
    ok: false,
    reason: 'unavailable',
    message: 'The booking service is unavailable',
  };
}

function isBookingView(value: unknown): value is BookingView {
  const booking = value as Partial<BookingView> | undefined;
  return (
    typeof booking?.id === 'string' &&
    typeof booking.status === 'string' &&
    typeof booking.listingId === 'string' &&
    typeof booking.renterId === 'string' &&
    typeof booking.ownerId === 'string' &&
    typeof booking.period?.start === 'string' &&
    typeof booking.period.end === 'string'
  );
}

/** Calls Booking over gRPC as the calling user, whose token Booking checks itself. */
@Injectable()
export class BookingClient implements OnModuleInit {
  private readonly logger = new Logger(BookingClient.name);
  private booking: BookingRpc;

  constructor(@Inject(BOOKING_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.booking = this.client.getService<BookingRpc>('BookingService');
  }

  /** The booking as the caller sees it. Never throws; a failure comes back as a ServiceResult. */
  async getBooking(
    id: string,
    call: CallContext,
  ): Promise<ServiceResult<BookingView>> {
    const result = await this.send('GetBooking', () =>
      this.booking.getBooking({ id }, metadataOf(call)),
    );
    if (result.ok && !isBookingView(result.value)) {
      this.logger.warn(`GetBooking ${id} answered an unexpected message`);
      return bookingFailure(undefined);
    }
    return result as ServiceResult<BookingView>;
  }

  /** Frees the booked dates after the return; repeating it is harmless. Never throws. */
  async releaseCalendar(
    bookingId: string,
    call: CallContext,
  ): Promise<ServiceResult<true>> {
    const result = await this.send('ReleaseCalendar', () =>
      this.booking.releaseCalendar({ bookingId }, metadataOf(call)),
    );
    return result.ok ? { ok: true, value: true } : result;
  }

  private async send(
    method: string,
    request: () => Observable<unknown>,
  ): Promise<ServiceResult<unknown>> {
    try {
      const value = await firstValueFrom(request().pipe(timeout(TIMEOUT_MS)));
      return { ok: true, value };
    } catch (error) {
      const failure = bookingFailure(error);
      this.logger.warn(
        `${method} failed (${failure.reason}): ${failure.message}`,
      );
      return failure;
    }
  }
}

/**
 * The caller's token, forwarded unchanged, the correlation ID, and Rental's service token, which
 * Booking requires on ReleaseCalendar.
 */
function metadataOf(call: CallContext): Metadata {
  const metadata = new Metadata();
  metadata.set('authorization', call.authorization);
  metadata.set('x-correlation-id', call.correlationId);
  metadata.set(SERVICE_TOKEN_HEADER, serviceTokens.token());
  return metadata;
}
