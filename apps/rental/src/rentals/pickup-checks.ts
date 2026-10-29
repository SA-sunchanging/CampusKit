import type { BookingView } from '../clients/booking.client.js';
import { samePerson } from './rental.response.js';
import type { RentalRow } from './rental.row.js';

/** The renter can pick up from this long before the period starts until the period ends. */
export const PICKUP_OPENS_BEFORE_MS = 24 * 60 * 60 * 1000;

/** Why pickup is refused at this time, or undefined inside [start - 24 h, end). */
export function pickupWindowError(
  row: RentalRow,
  now: Date,
): string | undefined {
  const opens = row.period_start.getTime() - PICKUP_OPENS_BEFORE_MS;
  if (now.getTime() < opens) {
    return 'Pickup opens 24 hours before the rental period starts';
  }
  if (now.getTime() >= row.period_end.getTime()) {
    return 'The rental period has ended, so the item can no longer be picked up';
  }
  return undefined;
}

/** Whether two ISO-8601 times are the same instant. */
function sameInstant(time: string, expected: Date): boolean {
  return new Date(time).getTime() === expected.getTime();
}

/**
 * Why the booking does not allow this pickup, or undefined when it is CONFIRMED for the same
 * listing, people and period as the rental.
 */
export function bookingProblem(
  row: RentalRow,
  booking: BookingView,
): string | undefined {
  if (booking.status !== 'CONFIRMED') {
    return 'The booking is not confirmed';
  }
  const matches =
    samePerson(booking.listingId, row.listing_id) &&
    samePerson(booking.renterId, row.renter_id) &&
    samePerson(booking.ownerId, row.owner_id) &&
    sameInstant(booking.period.start, row.period_start) &&
    sameInstant(booking.period.end, row.period_end);
  return matches ? undefined : 'The booking does not match the rental';
}
