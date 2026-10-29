import type { EntityManager } from 'typeorm';
import { RENTAL_COLUMNS, type RentalRow, updateRental } from './rental.row.js';

/**
 * A pickup claim holds the rental this long. A pickup ends well within it (two calls of at
 * most 5 s each), so an older claim belongs to a pickup that crashed and no longer counts.
 */
export const PICKUP_CLAIM_LEASE_MS = 2 * 60 * 1000;

/** Claims made at or before this time have lapsed. */
export function claimLapsedAt(now: Date): Date {
  return new Date(now.getTime() - PICKUP_CLAIM_LEASE_MS);
}

/** Whether a running pickup holds the rental at this time. */
export function hasFreshClaim(
  row: Pick<RentalRow, 'pickup_claimed_at'>,
  now: Date,
): boolean {
  return (
    row.pickup_claimed_at !== null &&
    row.pickup_claimed_at.getTime() > claimLapsedAt(now).getTime()
  );
}

/**
 * Claims an AWAITING_PICKUP rental that no running pickup holds, before the fee is captured,
 * so a cancellation cannot end it meanwhile. Returns undefined when the claim failed.
 */
export function claimPickup(
  tx: Pick<EntityManager, 'query'>,
  id: string,
  now: Date,
): Promise<RentalRow | undefined> {
  return updateRental(
    tx,
    `UPDATE rentals SET pickup_claimed_at = $2, updated_at = now()
     WHERE id = $1 AND status = 'AWAITING_PICKUP'
       AND (pickup_claimed_at IS NULL OR pickup_claimed_at <= $3)
     RETURNING ${RENTAL_COLUMNS}`,
    [id, now, claimLapsedAt(now)],
  );
}
