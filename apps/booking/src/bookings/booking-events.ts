import type { BookingEventData, BookingEventType } from '@app/contracts';
import { writeOutbox } from '@app/messaging';
import type { EntityManager } from 'typeorm';
import type { BookingRow } from './booking.row.js';

/** The data of a Booking event, taken from the row after the change. */
export function bookingEventData(row: BookingRow): BookingEventData {
  return {
    bookingId: row.id,
    listingId: row.listing_id,
    ownerId: row.owner_id,
    renterId: row.renter_id,
    period: {
      start: new Date(row.period_start).toISOString(),
      end: new Date(row.period_end).toISOString(),
    },
    status: row.status,
  };
}

/** The producer name in every Booking event envelope. */
export const PRODUCER = 'booking';

/**
 * Writes a Booking event to the outbox inside the transaction that changed the booking. A
 * reason, when given, goes into the data for the inbox to show (booking.cancelled).
 */
export async function announce(
  tx: EntityManager,
  type: BookingEventType,
  row: BookingRow,
  recipients: string[],
  correlationId: string,
  reason: string | null = null,
): Promise<void> {
  const data = bookingEventData(row);
  await writeOutbox(tx, {
    producer: PRODUCER,
    type,
    recipients,
    correlationId,
    data: reason === null ? data : { ...data, reason },
  });
}
