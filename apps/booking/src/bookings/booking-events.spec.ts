import type { EntityManager } from 'typeorm';
import type { BookingRow } from './booking.row.js';
import { announce, bookingEventData } from './booking-events.js';

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

describe('announce', () => {
  const row = {
    id: 'b1',
    listing_id: 'l1',
    owner_id: 'o1',
    renter_id: 'r1',
    status: 'CANCELLED',
    period_start: new Date('2026-11-01T17:00:00Z'),
    period_end: new Date('2026-11-04T17:00:00Z'),
  } as BookingRow;

  async function written(reason?: string | null) {
    const query = vi.fn().mockResolvedValue([]);
    await announce(
      { query } as unknown as EntityManager,
      'booking.cancelled',
      row,
      ['o1', 'r1'],
      'corr-1',
      reason,
    );
    const params = query.mock.calls[0][1] as unknown[];
    return JSON.parse(params[2] as string) as { data: Record<string, unknown> };
  }

  it('adds the reason to the data when one is given', async () => {
    expect((await written('Plans changed')).data).toMatchObject({
      bookingId: 'b1',
      reason: 'Plans changed',
    });
  });

  it('leaves the reason out otherwise', async () => {
    expect((await written()).data).not.toHaveProperty('reason');
    expect((await written(null)).data).not.toHaveProperty('reason');
  });
});
