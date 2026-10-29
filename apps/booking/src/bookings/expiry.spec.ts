import type { EntityManager } from 'typeorm';
import {
  bookingsOf,
  expireStale,
  isStale,
  oneBooking,
  oneBookingOf,
  onListingOrByRenter,
  staleBatch,
} from './expiry.js';

const now = new Date('2026-10-29T05:00:00Z');
const listingId = '11111111-1111-4111-8111-111111111111';
const userId = '00000000-0000-4000-8000-000000000002';

const expiredRow = {
  id: 'b1',
  listing_id: listingId,
  owner_id: 'o1',
  renter_id: userId,
  status: 'EXPIRED',
  period_start: new Date('2026-11-01T17:00:00Z'),
  period_end: new Date('2026-11-04T17:00:00Z'),
};

function fakeTx(rows: unknown[] = []) {
  const query = vi.fn((sql: string, _params: unknown[]) =>
    Promise.resolve(sql.includes('WITH expired') ? rows : []),
  );
  const events = () =>
    query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse(params[2] as string) as unknown);
  return { tx: { query } as unknown as EntityManager, query, events };
}

describe('expireStale', () => {
  it('expires stale PENDING bookings and releases their reservations', async () => {
    const { tx, query } = fakeTx([expiredRow]);
    await expect(
      expireStale(tx, onListingOrByRenter(listingId, userId), now, 'corr-1'),
    ).resolves.toEqual([expiredRow]);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      "WHERE status = 'PENDING' AND expires_at <= $1 AND (listing_id = $2 OR renter_id = $3)",
    );
    expect(sql).toContain('UPDATE calendar_blocks SET released_at = now()');
    expect(params).toEqual([now, listingId, userId]);
  });

  it('tells the owner and the renter of each booking it expired', async () => {
    const { tx, events } = fakeTx([expiredRow]);
    await expireStale(tx, oneBooking('b1'), now, 'corr-1');
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'booking.expired',
        recipients: ['o1', userId],
        correlationId: 'corr-1',
        data: expect.objectContaining({ bookingId: 'b1', status: 'EXPIRED' }),
      }),
    ]);
  });

  it('announces nothing when the statement changed no booking', async () => {
    // A concurrent expiry changed the row first; only that statement announces it.
    const { tx, events } = fakeTx([]);
    await expect(
      expireStale(tx, oneBooking('b1'), now, 'corr-1'),
    ).resolves.toEqual([]);
    expect(events()).toEqual([]);
  });

  it('never touches AUTHORIZING bookings', async () => {
    const { tx, query } = fakeTx();
    await expireStale(tx, oneBooking('b1'), now, 'corr-1');
    const [sql] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('AUTHORIZING');
    expect(sql).toContain("status = 'PENDING'");
  });

  it('lets the sweeper take a batch without waiting for locked bookings', () => {
    const scope = staleBatch(50);
    expect(scope.params).toEqual([50]);
    expect(scope.where).toContain("status = 'PENDING' AND expires_at <= $1");
    expect(scope.where).toContain('LIMIT $2');
    expect(scope.where).toContain('FOR UPDATE SKIP LOCKED');
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

describe('isStale', () => {
  it('is true for a PENDING request at or after its expiry', () => {
    expect(isStale({ status: 'PENDING', expires_at: now }, now)).toBe(true);
    expect(
      isStale(
        { status: 'PENDING', expires_at: new Date('2026-10-29T06:00:00Z') },
        now,
      ),
    ).toBe(false);
  });

  it('is false for AUTHORIZING', () => {
    expect(isStale({ status: 'AUTHORIZING', expires_at: now }, now)).toBe(
      false,
    );
  });
});
