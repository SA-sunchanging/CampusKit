import type { BookingView } from '../clients/booking.client.js';
import type { RentalRow } from '../rentals/rental.row.js';

/** IDs and times shared by the rental unit specs. */
export const RENTAL_ID = '11111111-1111-4111-8111-111111111111';
export const BOOKING_ID = '22222222-2222-4222-8222-222222222222';
export const LISTING_ID = '33333333-3333-4333-8333-333333333333';
export const OWNER_ID = '00000000-0000-4000-8000-000000000001';
export const RENTER_ID = '00000000-0000-4000-8000-000000000002';
export const STRANGER_ID = '00000000-0000-4000-8000-000000000003';
export const NOW = new Date('2026-10-29T05:00:00Z');

export function rentalRow(overrides: Partial<RentalRow> = {}): RentalRow {
  return {
    id: RENTAL_ID,
    booking_id: BOOKING_ID,
    listing_id: LISTING_ID,
    owner_id: OWNER_ID,
    renter_id: RENTER_ID,
    period_start: new Date('2026-11-01T17:00:00Z'),
    period_end: new Date('2026-11-04T17:00:00Z'),
    rental_fee: 6000,
    deposit: 30000,
    late_fee_per_day: 4000,
    status: 'AWAITING_PICKUP',
    pickup_code: '012345',
    return_code: '987654',
    pickup_attempts: 0,
    return_attempts: 0,
    picked_up_at: null,
    returned_at: null,
    closed_at: null,
    late_days: 0,
    late_fee: 0,
    last_error: null,
    pickup_claimed_at: null,
    reminder_sent_at: null,
    overdue_at: null,
    created_at: new Date('2026-10-29T04:00:00Z'),
    updated_at: new Date('2026-10-29T04:00:00Z'),
    ...overrides,
  };
}

/** The booking of rentalRow() as Booking's GetBooking answers it: CONFIRMED, same details. */
export function confirmedBooking(
  overrides: Partial<BookingView> = {},
): BookingView {
  return {
    id: BOOKING_ID,
    listingId: LISTING_ID,
    renterId: RENTER_ID,
    ownerId: OWNER_ID,
    status: 'CONFIRMED',
    period: {
      start: '2026-11-01T17:00:00.000Z',
      end: '2026-11-04T17:00:00.000Z',
    },
    terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
    ...overrides,
  };
}

/** The error a promise rejects with, or undefined when it resolves. */
export async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  return undefined;
}
