import { MAX_SATANG } from '../internal/dto/create-rental.dto.js';
import type { RentalRow } from './rental.row.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days late: every started 24 hours after the period ends counts, with no grace time. */
export function lateDays(periodEnd: Date, returnedAt: Date): number {
  const late = returnedAt.getTime() - periodEnd.getTime();
  return late > 0 ? Math.ceil(late / DAY_MS) : 0;
}

/**
 * The late days and late fee of a return at returnedAt. Rental stores both once, when the owner
 * accepts the return, so a settlement retried later never charges more. The fee is capped at
 * what the database column holds; Payment takes at most the deposit anyway.
 */
export function lateCharge(
  row: Pick<RentalRow, 'period_end' | 'late_fee_per_day'>,
  returnedAt: Date,
): { lateDays: number; lateFee: number } {
  const days = lateDays(row.period_end, returnedAt);
  return {
    lateDays: days,
    lateFee: Math.min(days * row.late_fee_per_day, MAX_SATANG),
  };
}
