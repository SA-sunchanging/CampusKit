import { BOOKING_EVENTS } from '@app/contracts';
import type { EntityManager } from 'typeorm';
import { announce } from './booking-events.js';
import { BOOKING_COLUMNS, type BookingRow } from './booking.row.js';

/** Which bookings a lazy expiry looks at; the condition uses $2 onwards. */
export interface ExpiryScope {
  where: string;
  params: unknown[];
}

/** Requests on the listing or by the renter (RequestBooking). */
export function onListingOrByRenter(
  listingId: string,
  renterId: string,
): ExpiryScope {
  return {
    where: 'listing_id = $2 OR renter_id = $3',
    params: [listingId, renterId],
  };
}

/** One booking (ApproveBooking, DeclineBooking). */
export function oneBooking(id: string): ExpiryScope {
  return { where: 'id = $2', params: [id] };
}

/** One booking, only when the user takes part in it (GetBooking). */
export function oneBookingOf(id: string, userId: string): ExpiryScope {
  return {
    where: 'id = $2 AND (renter_id = $3 OR owner_id = $3)',
    params: [id, userId],
  };
}

/** The user's bookings in one role (ListBookings). */
export function bookingsOf(
  userId: string,
  role: 'renter' | 'owner',
): ExpiryScope {
  return {
    where: role === 'renter' ? 'renter_id = $2' : 'owner_id = $2',
    params: [userId],
  };
}

/**
 * Up to limit stale PENDING bookings, earliest expiry first (the sweeper). SKIP LOCKED leaves
 * a booking that a request is deciding to that request.
 */
export function staleBatch(limit: number): ExpiryScope {
  return {
    where: `id IN (
       SELECT id FROM bookings
       WHERE status = 'PENDING' AND expires_at <= $1
       ORDER BY expires_at, id
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )`,
    params: [limit],
  };
}

/**
 * Marks the stale PENDING bookings in scope EXPIRED, releases their reservations and tells
 * both people, inside the caller's transaction. AUTHORIZING bookings never expire here.
 * Requests expire lazily when a request touches them and on the sweeper's schedule; only the
 * statement that changes a row announces it, so each expiry is announced once.
 * Returns the bookings it expired.
 */
export async function expireStale(
  tx: EntityManager,
  scope: ExpiryScope,
  now: Date,
  correlationId: string,
): Promise<BookingRow[]> {
  const rows = (await tx.query(
    `WITH expired AS (
       UPDATE bookings SET status = 'EXPIRED', updated_at = now()
       WHERE status = 'PENDING' AND expires_at <= $1 AND (${scope.where})
       RETURNING ${BOOKING_COLUMNS}
     ), released AS (
       UPDATE calendar_blocks SET released_at = now()
       WHERE released_at IS NULL AND booking_id IN (SELECT id FROM expired)
       RETURNING booking_id
     )
     SELECT * FROM expired`,
    [now, ...scope.params],
  )) as BookingRow[];
  for (const row of rows) {
    await announce(
      tx,
      BOOKING_EVENTS.expired,
      row,
      [row.owner_id, row.renter_id],
      correlationId,
    );
  }
  return rows;
}

/** True for a PENDING booking whose answer window has passed; expireStale would expire it. */
export function isStale(
  booking: Pick<BookingRow, 'status' | 'expires_at'>,
  now: Date,
): boolean {
  return booking.status === 'PENDING' && booking.expires_at <= now;
}
