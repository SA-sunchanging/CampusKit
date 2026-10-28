import { BOOKING_CLIENT } from '@app/contracts';
import { Metadata, status } from '@grpc/grpc-js';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable, timeout } from 'rxjs';
import type { Blackout } from '../listings/listing.entity.js';
import type { CallContext } from './call-context.js';

/** Booking answers within this time or counts as unavailable. */
const TIMEOUT_MS = 5_000;

/** The BookingService methods of libs/contracts/proto/booking.proto that Listing calls. */
interface BookingCalendar {
  setupCalendar(
    request: { listingId: string; blackouts: Blackout[] },
    metadata: Metadata,
  ): Observable<{ ok: boolean }>;
}

/** Thrown when Booking does not set up the calendar; the message is safe to show the owner. */
export class CalendarSetupError extends Error {}

/** A message for the owner that explains why calendar setup failed. */
export function calendarErrorMessage(error: unknown): string {
  const { code, details } = error as { code?: number; details?: string };
  switch (code) {
    case status.INVALID_ARGUMENT:
    case status.ALREADY_EXISTS:
    case status.PERMISSION_DENIED:
      return `The calendar was not saved: ${details ?? 'invalid dates'}`;
    default:
      return 'The booking service is unavailable; try publishing again later';
  }
}

/** Sets up a listing's calendar in Booking over gRPC, as the calling user. */
@Injectable()
export class CalendarClient implements OnModuleInit {
  private booking: BookingCalendar;

  constructor(@Inject(BOOKING_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.booking = this.client.getService<BookingCalendar>('BookingService');
  }

  /** Throws CalendarSetupError when Booking refuses or cannot be reached. */
  async setupCalendar(
    listingId: string,
    blackouts: Blackout[],
    call: CallContext,
  ): Promise<void> {
    const metadata = new Metadata();
    metadata.set('authorization', call.authorization);
    metadata.set('x-correlation-id', call.correlationId);
    try {
      await firstValueFrom(
        this.booking
          .setupCalendar({ listingId, blackouts }, metadata)
          .pipe(timeout(TIMEOUT_MS)),
      );
    } catch (error) {
      throw new CalendarSetupError(calendarErrorMessage(error));
    }
  }
}
