import type { AuthUser } from '@app/common';
import { BOOKING_EVENTS } from '@app/contracts';
import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import type { CallContext } from '../clients/call-context.js';
import { RentalClient } from '../clients/rental.client.js';
import { requireUuid, rpcError } from '../errors.js';
import { parseCancelReason } from './booking-rules.js';
import { announce } from './booking-events.js';
import {
  BOOKING_COLUMNS,
  type BookingRow,
  findBooking,
  updateBooking,
} from './booking.row.js';
import { Compensation, releaseDates } from './compensation.js';
import { expireStale, isStale, oneBooking } from './expiry.js';

const EXPIRED = 'EXPIRED';

/** Locks a booking for its renter or owner. Unknown: NOT_FOUND; anyone else: PERMISSION_DENIED. */
async function lockForParticipant(
  tx: EntityManager,
  caller: AuthUser,
  id: string,
): Promise<BookingRow> {
  const booking = await findBooking(tx, id, true);
  if (!booking) {
    throw rpcError(status.NOT_FOUND, 'Booking not found');
  }
  if (booking.owner_id !== caller.sub && booking.renter_id !== caller.sub) {
    throw rpcError(
      status.PERMISSION_DENIED,
      'Only the renter or the listing owner can cancel this booking',
    );
  }
  return booking;
}

/**
 * The booking in status from becomes CANCELLED, its dates are released and both people are
 * told, inside the caller's transaction. Returns undefined when it is no longer in from.
 */
async function cancelFrom(
  tx: EntityManager,
  id: string,
  from: 'PENDING' | 'CONFIRMED',
  reason: string | null,
  correlationId: string,
): Promise<BookingRow | undefined> {
  const cancelled = await updateBooking(
    tx,
    `UPDATE bookings SET status = 'CANCELLED', updated_at = now()
     WHERE id = $1 AND status = $2
     RETURNING ${BOOKING_COLUMNS}`,
    [id, from],
  );
  if (cancelled) {
    await releaseDates(tx, [id]);
    await announce(
      tx,
      BOOKING_EVENTS.cancelled,
      cancelled,
      [cancelled.owner_id, cancelled.renter_id],
      correlationId,
      reason,
    );
  }
  return cancelled;
}

/** The renter or the listing owner cancels a booking before pickup. No fee is charged. */
@Injectable()
export class BookingCancellationService {
  private readonly logger = new Logger(BookingCancellationService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly rental: RentalClient,
    private readonly compensation: Compensation,
  ) {}

  /**
   * PENDING becomes CANCELLED at once. A CONFIRMED booking first cancels its rental with
   * Rental, which refuses once the item is picked up (FAILED_PRECONDITION), then becomes
   * CANCELLED and its holds are voided; the sweeper retries a failed void. Either way the
   * dates are released and both people are told, with the optional reason. A CANCELLED
   * booking is returned unchanged; any other status answers FAILED_PRECONDITION.
   */
  async cancel(
    caller: AuthUser,
    id: string,
    reason: string | undefined,
    call: CallContext,
    now = new Date(),
  ): Promise<BookingRow> {
    requireUuid(id, 'id');
    const text = parseCancelReason(reason);
    const booking = await this.db.transaction((tx) =>
      this.cancelUnconfirmed(tx, caller, id, text, call, now),
    );
    if (booking === EXPIRED) {
      throw rpcError(status.FAILED_PRECONDITION, 'The request has expired');
    }
    if (booking.status !== 'CONFIRMED') {
      return booking;
    }
    await this.cancelRental(id, call);
    return this.cancelConfirmed(id, text, call);
  }

  /** CONFIRMED becomes CANCELLED once, then the holds are voided; the sweeper retries a failed void. */
  private async cancelConfirmed(
    id: string,
    reason: string | null,
    call: CallContext,
  ): Promise<BookingRow> {
    const result = await this.db.transaction(async (tx) => {
      const cancelled = await cancelFrom(
        tx,
        id,
        'CONFIRMED',
        reason,
        call.correlationId,
      );
      // undefined: a concurrent cancellation won, and it voids the holds.
      return cancelled
        ? { booking: cancelled, changed: true }
        : {
            booking: (await findBooking(tx, id)) as BookingRow,
            changed: false,
          };
    });
    if (result.changed) {
      this.logger.log(`Booking ${id} cancelled after confirmation`);
      await this.compensation.voidHolds(id, call);
    }
    return result.booking;
  }

  /**
   * Cancels a PENDING booking, or returns a CONFIRMED or CANCELLED one as it is for the
   * caller to continue. A stale PENDING request expires instead.
   */
  private async cancelUnconfirmed(
    tx: EntityManager,
    caller: AuthUser,
    id: string,
    reason: string | null,
    call: CallContext,
    now: Date,
  ): Promise<BookingRow | typeof EXPIRED> {
    const booking = await lockForParticipant(tx, caller, id);
    if (isStale(booking, now)) {
      // Commit the expiry, then answer FAILED_PRECONDITION outside the transaction.
      await expireStale(tx, oneBooking(id), now, call.correlationId);
      return EXPIRED;
    }
    switch (booking.status) {
      case 'PENDING':
        return (await cancelFrom(
          tx,
          id,
          'PENDING',
          reason,
          call.correlationId,
        )) as BookingRow;
      case 'CONFIRMED':
      case 'CANCELLED':
        return booking;
      default:
        throw rpcError(
          status.FAILED_PRECONDITION,
          `The booking is ${booking.status} and cannot be cancelled`,
        );
    }
  }

  /** Cancels the rental, or throws: FAILED_PRECONDITION once picked up, else UNAVAILABLE. */
  private async cancelRental(id: string, call: CallContext): Promise<void> {
    const result = await this.rental.cancelByBooking(id, call);
    if (result.ok) {
      return;
    }
    this.logger.warn(`Booking ${id} not cancelled: ${result.message}`);
    throw rpcError(
      result.reason === 'declined'
        ? status.FAILED_PRECONDITION
        : status.UNAVAILABLE,
      result.message,
    );
  }
}
