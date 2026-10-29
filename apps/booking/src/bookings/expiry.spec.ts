import type { EntityManager } from 'typeorm';
import {
  bookingsOf,
  expireStale,
  oneBooking,
  oneBookingOf,
  onListingOrByRenter,
} from './expiry.js';

const now = new Date('2026-10-29T05:00:00Z');
const listingId = '11111111-1111-4111-8111-111111111111';
const userId = '00000000-0000-4000-8000-000000000002';

function fakeTx(rows: { id: string }[] = []) {
  const query = vi.fn().mockResolvedValue(rows);
  return { tx: { query } as unknown as EntityManager, query };
}

describe('expireStale', () => {
  it('expires stale PENDING bookings and releases their reservations', async () => {
    const { tx, query } = fakeTx([{ id: 'b1' }]);
    await expect(
      expireStale(tx, onListingOrByRenter(listingId, userId), now),
    ).resolves.toEqual(['b1']);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      "WHERE status = 'PENDING' AND expires_at <= $1 AND (listing_id = $2 OR renter_id = $3)",
    );
    expect(sql).toContain('UPDATE calendar_blocks SET released_at = now()');
    expect(params).toEqual([now, listingId, userId]);
  });

  it('never touches AUTHORIZING bookings', async () => {
    const { tx, query } = fakeTx();
    await expireStale(tx, oneBooking('b1'), now);
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).not.toContain('AUTHORIZING');
    expect(sql).toContain("status = 'PENDING'");
  });

  it('limits get and list to the caller', () => {
    expect(oneBookingOf('b1', userId)).toEqual({
      where: 'id = $2 AND (renter_id = $3 OR owner_id = $3)',
      params: ['b1', userId],
    });
    expect(bookingsOf(userId, 'renter').where).toBe('renter_id = $2');
    expect(bookingsOf(userId, 'owner').where).toBe('owner_id = $2');
  });
});
