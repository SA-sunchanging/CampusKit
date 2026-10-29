import { BOOKING_CLIENT } from '@app/contracts';
import { Metadata, status } from '@grpc/grpc-js';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  filterAvailable(
    request: { listingIds: string[]; period: Blackout },
    metadata: Metadata,
  ): Observable<{ listingIds?: string[] }>;
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

/** Calls the calendar of Booking over gRPC: setup as the calling user, and the search filter. */
@Injectable()
export class CalendarClient implements OnModuleInit {
  private readonly logger = new Logger(CalendarClient.name);
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

  /**
   * The listings free for the whole period, in the given order (at most 200). Throws 503 when
   * Booking cannot answer, because the caller asked for dates explicitly.
   */
  async filterAvailable(
    listingIds: string[],
    period: Blackout,
    correlationId: string,
  ): Promise<string[]> {
    const metadata = new Metadata();
    metadata.set('x-correlation-id', correlationId);
    try {
      const reply = await firstValueFrom(
        this.booking
          .filterAvailable({ listingIds, period }, metadata)
          .pipe(timeout(TIMEOUT_MS)),
      );
      return reply.listingIds ?? [];
    } catch (error) {
      const { code, details } = error as { code?: number; details?: string };
      if (code === status.INVALID_ARGUMENT) {
        throw new BadRequestException(details ?? 'Invalid dates');
      }
      this.logger.warn(`FilterAvailable failed: ${details ?? String(error)}`);
      throw new ServiceUnavailableException(
        'The booking service is unavailable; search without dates or try again later',
      );
    }
  }
}
