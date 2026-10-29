import type { EntityManager } from 'typeorm';
import {
  BOOKING_ID,
  LISTING_ID,
  OWNER_ID,
  RENTAL_ID,
  RENTER_ID,
  rentalRow,
} from '../testing/fixtures.js';
import { announce, rentalEventData } from './rental-events.js';

describe('rentalEventData', () => {
  it('carries the IDs, the period in ISO-8601 UTC, the new status and the late fee', () => {
    const row = rentalRow({ status: 'CLOSED', late_fee: 8000 });
    expect(rentalEventData(row)).toEqual({
      rentalId: RENTAL_ID,
      bookingId: BOOKING_ID,
      listingId: LISTING_ID,
      ownerId: OWNER_ID,
      renterId: RENTER_ID,
      period: {
        start: '2026-11-01T17:00:00.000Z',
        end: '2026-11-04T17:00:00.000Z',
      },
      status: 'CLOSED',
      lateFee: 8000,
    });
  });
});

describe('announce', () => {
  it('writes the event for the owner and the renter, produced by rental', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const row = rentalRow({ status: 'ACTIVE' });
    await announce(
      { query } as unknown as EntityManager,
      'rental.started',
      row,
      'corr-1',
    );
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO outbox_events');
    expect(JSON.parse(params[2] as string)).toMatchObject({
      type: 'rental.started',
      producer: 'rental',
      recipients: [OWNER_ID, RENTER_ID],
      correlationId: 'corr-1',
      data: { rentalId: RENTAL_ID, status: 'ACTIVE', lateFee: 0 },
    });
  });

  it('writes the event only for the given recipients', async () => {
    const query = vi.fn().mockResolvedValue([]);
    await announce(
      { query } as unknown as EntityManager,
      'rental.reminded',
      rentalRow({ status: 'ACTIVE' }),
      'corr-1',
      [RENTER_ID],
    );
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(JSON.parse(params[2] as string)).toMatchObject({
      type: 'rental.reminded',
      recipients: [RENTER_ID],
    });
  });
});
