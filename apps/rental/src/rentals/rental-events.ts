import type { RentalEventData, RentalEventType } from '@app/contracts';
import { writeOutbox } from '@app/messaging';
import type { EntityManager } from 'typeorm';
import type { RentalRow } from './rental.row.js';

/** The producer name in every Rental event envelope. */
export const PRODUCER = 'rental';

/** The data of a Rental event, taken from the row after the change. */
export function rentalEventData(row: RentalRow): RentalEventData {
  return {
    rentalId: row.id,
    bookingId: row.booking_id,
    listingId: row.listing_id,
    ownerId: row.owner_id,
    renterId: row.renter_id,
    period: {
      start: new Date(row.period_start).toISOString(),
      end: new Date(row.period_end).toISOString(),
    },
    status: row.status,
    lateFee: row.late_fee,
  };
}

/**
 * Writes a Rental event for both the owner and the renter to the outbox, inside the transaction
 * that changed the rental.
 */
export async function announce(
  tx: EntityManager,
  type: RentalEventType,
  row: RentalRow,
  correlationId: string,
): Promise<void> {
  await writeOutbox(tx, {
    producer: PRODUCER,
    type,
    recipients: [row.owner_id, row.renter_id],
    correlationId,
    data: rentalEventData(row),
  });
}
