import type { BookingRow } from './booking.row.js';
import { bookingEventData } from './booking-events.js';

describe('bookingEventData', () => {
  it('carries the IDs, the period in ISO-8601 UTC and the new status', () => {
    const row = {
      id: 'b1',
      listing_id: 'l1',
      owner_id: 'o1',
      renter_id: 'r1',
      status: 'CONFIRMED',
      period_start: new Date('2026-11-01T17:00:00Z'),
      period_end: new Date('2026-11-04T17:00:00Z'),
    } as BookingRow;
    expect(bookingEventData(row)).toEqual({
      bookingId: 'b1',
      listingId: 'l1',
      ownerId: 'o1',
      renterId: 'r1',
      period: {
        start: '2026-11-01T17:00:00.000Z',
        end: '2026-11-04T17:00:00.000Z',
      },
      status: 'CONFIRMED',
    });
  });
});
