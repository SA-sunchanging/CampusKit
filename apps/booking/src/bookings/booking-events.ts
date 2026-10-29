import type { BookingEventData, BookingEventType } from '@app/contracts';
import type { EntityManager } from 'typeorm';
import { writeOutbox } from '../outbox/outbox.js';
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

/** Writes a Booking event to the outbox inside the transaction that changed the booking. */
export async function announce(
  tx: EntityManager,
  type: BookingEventType,
  row: BookingRow,
  recipients: string[],
  correlationId: string,
): Promise<void> {
  await writeOutbox(tx, {
    type,
    recipients,
    correlationId,
    data: bookingEventData(row),
  });
}
