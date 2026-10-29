import type { EntityManager } from 'typeorm';
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

/** The booking with this ID, locked until the transaction ends when lock is true. */
export async function findBooking(
  tx: EntityManager,
  id: string,
  lock = false,
): Promise<BookingRow | undefined> {
  const [row] = (await tx.query(
    `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  )) as BookingRow[];
  return row;
}

/**
 * Runs an UPDATE ... RETURNING BOOKING_COLUMNS and returns the updated row, or undefined when
 * its WHERE matched nothing. TypeORM answers an UPDATE with [rows, affected].
 */
export async function updateBooking(
  tx: EntityManager,
  sql: string,
  params: unknown[],
): Promise<BookingRow | undefined> {
  const [rows] = (await tx.query(sql, params)) as [BookingRow[], number];
  return rows[0];
}
