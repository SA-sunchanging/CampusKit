import type { BookingStatus } from './booking.entity.js';

/** A bookings row as the queries below return it (snake_case, period split in two). */
export interface BookingRow {
  id: string;
  listing_id: string;
  renter_id: string;
  owner_id: string;
  status: BookingStatus;
  period_start: Date;
  period_end: Date;
  rental_fee: number;
  deposit: number;
  late_fee_per_day: number;
  decline_reason: string | null;
  last_error: string | null;
  rental_id: string | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

/** The select list (or RETURNING list) that produces a BookingRow. */
export const BOOKING_COLUMNS = `id, listing_id, renter_id, owner_id, status,
  lower(period) AS period_start, upper(period) AS period_end,
  rental_fee, deposit, late_fee_per_day, decline_reason, last_error, rental_id,
  expires_at, created_at, updated_at`;
