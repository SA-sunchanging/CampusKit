import { RENTAL_EVENTS } from '@app/contracts';
import type { EntityManager } from 'typeorm';
import { announce } from './rental-events.js';
import { RENTAL_COLUMNS, type RentalRow } from './rental.row.js';

/** The sweeper changes at most this many rentals per statement. */
export const SWEEP_BATCH = 50;

/**
 * ACTIVE rentals whose period ends within the lead ($1 = now, $2 = now + lead) and whose renter
 * has not been reminded. A rental whose period has already ended is never reminded: it is
 * flagged overdue instead.
 */
const REMINDER_DUE = `status = 'ACTIVE' AND reminder_sent_at IS NULL
  AND period_end > $1 AND period_end <= $2`;

/** ACTIVE rentals whose period ended ($1 = now) and that are not flagged overdue yet. */
const OVERDUE_DUE = `status = 'ACTIVE' AND overdue_at IS NULL AND period_end <= $1`;

/**
 * Sets column to $1 on up to limit rentals that match condition, earliest period end first, and
 * returns them. SKIP LOCKED leaves a rental that another sweeper or a return holds to that
 * transaction; the outer WHERE checks the condition again on the locked row, so only the
 * statement that changes a row returns it. TypeORM answers an UPDATE with [rows, affected].
 */
async function mark(
  tx: EntityManager,
  column: 'reminder_sent_at' | 'overdue_at',
  condition: string,
  params: unknown[],
): Promise<RentalRow[]> {
  const limit = `$${params.length + 1}`;
  const [rows] = (await tx.query(
    `UPDATE rentals SET ${column} = $1, updated_at = now()
     WHERE ${condition} AND id IN (
       SELECT id FROM rentals
       WHERE ${condition}
       ORDER BY period_end, id
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED
     )
     RETURNING ${RENTAL_COLUMNS}`,
    [...params, SWEEP_BATCH],
  )) as [RentalRow[], number];
  return rows;
}

/**
 * Reminds the renters of a batch of ACTIVE rentals whose period ends within leadMs of now:
 * sets reminder_sent_at and writes rental.reminded to the renter, inside the caller's
 * transaction. Each rental is reminded once. Returns the rentals it reminded.
 */
export async function remindEnding(
  tx: EntityManager,
  now: Date,
  leadMs: number,
  correlationId: string,
): Promise<RentalRow[]> {
  const rows = await mark(tx, 'reminder_sent_at', REMINDER_DUE, [
    now,
    new Date(now.getTime() + leadMs),
  ]);
  for (const row of rows) {
    await announce(tx, RENTAL_EVENTS.reminded, row, correlationId, [
      row.renter_id,
    ]);
  }
  return rows;
}

/**
 * Flags a batch of ACTIVE rentals whose period has ended overdue: sets overdue_at and writes
 * rental.overdue to the owner and the renter, inside the caller's transaction. Each rental is
 * flagged once; the status stays ACTIVE until the return. Returns the rentals it flagged.
 */
export async function flagOverdue(
  tx: EntityManager,
  now: Date,
  correlationId: string,
): Promise<RentalRow[]> {
  const rows = await mark(tx, 'overdue_at', OVERDUE_DUE, [now]);
  for (const row of rows) {
    await announce(tx, RENTAL_EVENTS.overdue, row, correlationId);
  }
  return rows;
}
