import type { AuthUser } from '@app/common';
import { BOOKING_EVENTS } from '@app/contracts';
import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import type { CallContext } from '../clients/call-context.js';
import { PaymentClient } from '../clients/payment.client.js';
import { RentalClient } from '../clients/rental.client.js';
import { requireUuid, rpcError } from '../errors.js';
import { authorizeAndCreateRental } from './approval.js';
import { parseDeclineReason } from './booking-rules.js';
import { announce } from './booking-events.js';
import { Compensation, failApproval, PERIOD_STARTED } from './compensation.js';
import {
  BOOKING_COLUMNS,
  type BookingRow,
  findBooking,
  updateBooking,
} from './booking.row.js';
import { expireStale, isStale, oneBooking } from './expiry.js';

/**
 * Locks a booking for a decision by its owner. Anyone who does not take part gets NOT_FOUND
 * and the renter gets PERMISSION_DENIED.
 */
async function lockForOwner(
  tx: EntityManager,
  caller: AuthUser,
  id: string,
): Promise<BookingRow> {
  const booking = await findBooking(tx, id, true);
  if (
    !booking ||
    (booking.owner_id !== caller.sub && booking.renter_id !== caller.sub)
  ) {
    throw rpcError(status.NOT_FOUND, 'Booking not found');
  }
  if (booking.owner_id !== caller.sub) {
    throw rpcError(
      status.PERMISSION_DENIED,
      'Only the listing owner can decide on this request',
    );
  }
  return booking;
}

const EXPIRED = 'EXPIRED';

function expiredError() {
  return rpcError(status.FAILED_PRECONDITION, 'The request has expired');
}

/** The listing owner's decisions on a request: approve or decline. */
@Injectable()
export class BookingDecisionsService {
  private readonly logger = new Logger(BookingDecisionsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly payment: PaymentClient,
    private readonly rental: RentalClient,
    private readonly compensation: Compensation,
  ) {}

  /**
   * The owner accepts a request. PENDING becomes AUTHORIZING; then Booking authorizes the fee
   * and deposit and creates the rental, and the booking becomes CONFIRMED. When a service is
   * unavailable, the booking stays AUTHORIZING with the reason in last_error, and approving
   * again retries the same idempotent calls until the period starts. When a service refuses,
   * or the period has started, the booking becomes FAILED and its holds are voided.
   */
  async approve(
    caller: AuthUser,
    id: string,
    call: CallContext,
    now = new Date(),
  ): Promise<BookingRow> {
    requireUuid(id, 'id');
    const booking = await this.startApproval(caller, id, now, call);
    if (booking.status !== 'AUTHORIZING') {
      return booking;
    }
    const outcome = await authorizeAndCreateRental(
      this.payment,
      this.rental,
      booking,
      call,
    );
    if (outcome.ok) {
      return this.confirm(id, outcome.rentalId, call);
    }
    if (outcome.final) {
      this.logger.warn(`Booking ${id} failed: ${outcome.error}`);
      return this.fail(id, outcome.error, call);
    }
    this.logger.warn(`Booking ${id} stays AUTHORIZING: ${outcome.error}`);
    return this.recordFailure(id, outcome.error);
  }

  /**
   * The owner rejects a PENDING request: the booking becomes DECLINED with the optional
   * reason, the dates are released, and the renter is told through the outbox.
   */
  async decline(
    caller: AuthUser,
    id: string,
    reason: string | undefined,
    call: CallContext,
    now = new Date(),
  ): Promise<BookingRow> {
    requireUuid(id, 'id');
    const text = parseDeclineReason(reason);
    const result = await this.db.transaction(async (tx) => {
      const booking = await lockForOwner(tx, caller, id);
      if (isStale(booking, now)) {
        await expireStale(tx, oneBooking(id), now);
        return EXPIRED;
      }
      if (booking.status !== 'PENDING') {
        throw rpcError(
          status.FAILED_PRECONDITION,
          `The booking is ${booking.status} and cannot be declined`,
        );
      }
      const declined = (await updateBooking(
        tx,
        `UPDATE bookings
         SET status = 'DECLINED', decline_reason = $2, updated_at = now()
         WHERE id = $1 AND status = 'PENDING'
         RETURNING ${BOOKING_COLUMNS}`,
        [id, text],
      )) as BookingRow;
      await tx.query(
        `UPDATE calendar_blocks SET released_at = now()
         WHERE booking_id = $1 AND released_at IS NULL`,
        [id],
      );
      await announce(
        tx,
        BOOKING_EVENTS.declined,
        declined,
        [declined.renter_id],
        call.correlationId,
      );
      return declined;
    });
    if (result === EXPIRED) {
      throw expiredError();
    }
    return result;
  }

  /**
   * Moves PENDING to AUTHORIZING, or returns an AUTHORIZING or CONFIRMED booking as it is. An
   * AUTHORIZING booking whose period has started becomes FAILED and is returned so.
   */
  private async startApproval(
    caller: AuthUser,
    id: string,
    now: Date,
    call: CallContext,
  ): Promise<BookingRow> {
    const result = await this.db.transaction(async (tx) => {
      const booking = await lockForOwner(tx, caller, id);
      if (isStale(booking, now)) {
        // Commit the expiry, then answer FAILED_PRECONDITION outside the transaction.
        await expireStale(tx, oneBooking(id), now);
        return EXPIRED;
      }
      switch (booking.status) {
        case 'PENDING':
          return (await updateBooking(
            tx,
            `UPDATE bookings SET status = 'AUTHORIZING', updated_at = now()
             WHERE id = $1 AND status = 'PENDING'
             RETURNING ${BOOKING_COLUMNS}`,
            [id],
          )) as BookingRow;
        case 'AUTHORIZING':
          if (now >= booking.period_start) {
            return (
              (await failApproval(
                tx,
                id,
                PERIOD_STARTED,
                call.correlationId,
              )) ?? booking
            );
          }
          return booking;
        case 'CONFIRMED':
          return booking;
        default:
          throw rpcError(
            status.FAILED_PRECONDITION,
            `The booking is ${booking.status} and cannot be approved`,
          );
      }
    });
    if (result === EXPIRED) {
      throw expiredError();
    }
    if (result.status === 'FAILED') {
      await this.compensation.voidHolds(id, call);
    }
    return result;
  }

  /** Fails the booking for good, then voids its holds; the sweeper retries a failed void. */
  private async fail(
    id: string,
    error: string,
    call: CallContext,
  ): Promise<BookingRow> {
    const failed = await this.db.transaction(
      async (tx) =>
        (await failApproval(tx, id, error, call.correlationId)) ??
        // undefined: a concurrent approval confirmed or failed the booking meanwhile.
        ((await findBooking(tx, id)) as BookingRow),
    );
    if (failed.status === 'FAILED') {
      await this.compensation.voidHolds(id, call);
    }
    return failed;
  }

  private recordFailure(id: string, error: string): Promise<BookingRow> {
    return this.db.transaction(async (tx) => {
      const updated = await updateBooking(
        tx,
        `UPDATE bookings SET last_error = $2, updated_at = now()
         WHERE id = $1 AND status = 'AUTHORIZING'
         RETURNING ${BOOKING_COLUMNS}`,
        [id, error],
      );
      // undefined: a concurrent approval confirmed the booking meanwhile.
      return updated ?? ((await findBooking(tx, id)) as BookingRow);
    });
  }

  /** AUTHORIZING becomes CONFIRMED once, even when two approvals race to this point. */
  private confirm(
    id: string,
    rentalId: string,
    call: CallContext,
  ): Promise<BookingRow> {
    return this.db.transaction(async (tx) => {
      const confirmed = await updateBooking(
        tx,
        `UPDATE bookings
         SET status = 'CONFIRMED', rental_id = $2, last_error = NULL, updated_at = now()
         WHERE id = $1 AND status = 'AUTHORIZING'
         RETURNING ${BOOKING_COLUMNS}`,
        [id, rentalId],
      );
      if (!confirmed) {
        return (await findBooking(tx, id)) as BookingRow;
      }
      await announce(
        tx,
        BOOKING_EVENTS.confirmed,
        confirmed,
        [confirmed.owner_id, confirmed.renter_id],
        call.correlationId,
      );
      return confirmed;
    });
  }
}
