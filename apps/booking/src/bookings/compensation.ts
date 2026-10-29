import { BOOKING_EVENTS } from '@app/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import type { CallContext } from '../clients/call-context.js';
import { PaymentClient } from '../clients/payment.client.js';
import { announce } from './booking-events.js';
import { BOOKING_COLUMNS, type BookingRow } from './booking.row.js';

/** last_error of a booking whose period started before its approval completed. */
export const PERIOD_STARTED =
  'The rental period started before the approval could be completed';

/** A sweep fails and voids at most this many bookings. */
export const SWEEP_BATCH = 50;

/** Releases the reservations of the bookings, inside the caller's transaction. */
export async function releaseDates(
  tx: EntityManager,
  ids: string[],
): Promise<void> {
  await tx.query(
    `UPDATE calendar_blocks SET released_at = now()
     WHERE booking_id = ANY($1::uuid[]) AND released_at IS NULL`,
    [ids],
  );
}

/** Tells the renter and the owner that the booking will not go ahead. */
function announceFailure(
  tx: EntityManager,
  row: BookingRow,
  correlationId: string,
): Promise<void> {
  return announce(
    tx,
    BOOKING_EVENTS.failed,
    row,
    [row.owner_id, row.renter_id],
    correlationId,
  );
}

/**
 * AUTHORIZING becomes FAILED with the reason, the dates are released and both people are told,
 * inside the caller's transaction. Returns undefined when the booking is no longer AUTHORIZING.
 */
export async function failApproval(
  tx: EntityManager,
  id: string,
  reason: string,
  correlationId: string,
): Promise<BookingRow | undefined> {
  const [rows] = (await tx.query(
    `UPDATE bookings SET status = 'FAILED', last_error = $2, updated_at = now()
     WHERE id = $1 AND status = 'AUTHORIZING'
     RETURNING ${BOOKING_COLUMNS}`,
    [id, reason],
  )) as [BookingRow[], number];
  const failed = rows[0];
  if (failed) {
    await releaseDates(tx, [failed.id]);
    await announceFailure(tx, failed, correlationId);
  }
  return failed;
}

/**
 * Fails up to SWEEP_BATCH AUTHORIZING bookings whose period has started, as failApproval does.
 * SKIP LOCKED leaves a booking that an approval is deciding to that approval.
 */
export async function failStartedApprovals(
  tx: EntityManager,
  now: Date,
  correlationId: string,
): Promise<BookingRow[]> {
  const [rows] = (await tx.query(
    `UPDATE bookings SET status = 'FAILED', last_error = $2, updated_at = now()
     WHERE id IN (
       SELECT id FROM bookings
       WHERE status = 'AUTHORIZING' AND lower(period) <= $1
       ORDER BY lower(period), id
       LIMIT $3
       FOR UPDATE SKIP LOCKED
     )
     RETURNING ${BOOKING_COLUMNS}`,
    [now, PERIOD_STARTED, SWEEP_BATCH],
  )) as [BookingRow[], number];
  if (rows.length > 0) {
    await releaseDates(
      tx,
      rows.map((row) => row.id),
    );
    for (const row of rows) {
      await announceFailure(tx, row, correlationId);
    }
  }
  return rows;
}

/**
 * Voids the Payment holds of FAILED bookings and of cancelled bookings that were CONFIRMED
 * (they have a rental_id), and records when that succeeded.
 */
@Injectable()
export class Compensation {
  private readonly logger = new Logger(Compensation.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly payment: PaymentClient,
  ) {}

  /**
   * Asks Payment to void the booking's open holds. True once Payment has voided them; false
   * when Payment did not answer, so the sweeper tries again later. Never throws.
   */
  async voidHolds(bookingId: string, call: CallContext): Promise<boolean> {
    const result = await this.payment.voidHolds(bookingId, call);
    if (!result.ok) {
      this.logger.warn(
        `Holds of booking ${bookingId} not voided yet: ${result.message}`,
      );
      return false;
    }
    await this.db.query(
      `UPDATE bookings SET holds_voided_at = now()
       WHERE id = $1 AND holds_voided_at IS NULL`,
      [bookingId],
    );
    return true;
  }

  /**
   * IDs of FAILED bookings and of cancelled CONFIRMED bookings whose holds are not voided yet,
   * oldest first. A booking cancelled while PENDING never had holds.
   */
  async unvoided(): Promise<string[]> {
    const rows = (await this.db.query(
      `SELECT id FROM bookings
       WHERE (status = 'FAILED' OR (status = 'CANCELLED' AND rental_id IS NOT NULL))
         AND holds_voided_at IS NULL
       ORDER BY updated_at, id
       LIMIT $1`,
      [SWEEP_BATCH],
    )) as { id: string }[];
    return rows.map((row) => row.id);
  }
}
