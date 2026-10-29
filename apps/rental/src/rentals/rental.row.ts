import type { EntityManager } from 'typeorm';
import type { RentalStatus } from './rental.entity.js';

/** A rentals row as the queries below return it (snake_case). */
export interface RentalRow {
  id: string;
  booking_id: string;
  listing_id: string;
  owner_id: string;
  renter_id: string;
  period_start: Date;
  period_end: Date;
  rental_fee: number;
  deposit: number;
  late_fee_per_day: number;
  status: RentalStatus;
  pickup_code: string;
  return_code: string;
  pickup_attempts: number;
  return_attempts: number;
  picked_up_at: Date | null;
  returned_at: Date | null;
  closed_at: Date | null;
  late_days: number;
  late_fee: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

/** The select list (or RETURNING list) that produces a RentalRow. */
export const RENTAL_COLUMNS = `id, booking_id, listing_id, owner_id, renter_id,
  period_start, period_end, rental_fee, deposit, late_fee_per_day, status,
  pickup_code, return_code, pickup_attempts, return_attempts,
  picked_up_at, returned_at, closed_at, late_days, late_fee, last_error,
  created_at, updated_at`;

/** The rental with this ID, locked until the transaction ends when lock is true. */
export async function findRental(
  tx: Pick<EntityManager, 'query'>,
  id: string,
  lock = false,
): Promise<RentalRow | undefined> {
  const [row] = (await tx.query(
    `SELECT ${RENTAL_COLUMNS} FROM rentals WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  )) as RentalRow[];
  return row;
}

/**
 * Runs an UPDATE ... RETURNING RENTAL_COLUMNS and returns the updated row, or undefined when
 * its WHERE matched nothing. TypeORM answers an UPDATE with [rows, affected].
 */
export async function updateRental(
  tx: Pick<EntityManager, 'query'>,
  sql: string,
  params: unknown[],
): Promise<RentalRow | undefined> {
  const [rows] = (await tx.query(sql, params)) as [RentalRow[], number];
  return rows[0];
}
