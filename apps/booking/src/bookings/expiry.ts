import type { EntityManager } from 'typeorm';
import type { BookingRow } from './booking.row.js';

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
 * Lazy expiry: marks the stale PENDING bookings in scope EXPIRED and releases their
 * reservations, inside the caller's transaction. AUTHORIZING bookings never expire here.
 * Returns the IDs of the bookings it expired.
 */
export async function expireStale(
  tx: EntityManager,
  scope: ExpiryScope,
  now: Date,
): Promise<string[]> {
  const rows = (await tx.query(
    `WITH expired AS (
       UPDATE bookings SET status = 'EXPIRED', updated_at = now()
       WHERE status = 'PENDING' AND expires_at <= $1 AND (${scope.where})
       RETURNING id
     ), released AS (
       UPDATE calendar_blocks SET released_at = now()
       WHERE released_at IS NULL AND booking_id IN (SELECT id FROM expired)
       RETURNING booking_id
     )
     SELECT id FROM expired`,
    [now, ...scope.params],
  )) as { id: string }[];
  return rows.map((row) => row.id);
}

/** True for a PENDING booking whose answer window has passed; expireStale would expire it. */
export function isStale(
  booking: Pick<BookingRow, 'status' | 'expires_at'>,
  now: Date,
): boolean {
  return booking.status === 'PENDING' && booking.expires_at <= now;
}
