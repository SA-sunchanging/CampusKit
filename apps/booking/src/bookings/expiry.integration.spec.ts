import { randomUUID } from 'node:crypto';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import type { BookingRow } from './booking.row.js';
import { expireStale, oneBooking, staleBatch } from './expiry.js';

const OWNER_ID = randomUUID();
const now = new Date('2026-10-29T05:00:00Z');
const START = '2026-11-01T17:00:00Z';
const END = '2026-11-04T17:00:00Z';
/** The answer window closed an hour before now. */
const EXPIRED_AT = '2026-10-29T04:00:00Z';

/** A promise with its resolve function, to hold a transaction open. */
function gate(): { wait: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'request expiry (PostgreSQL)',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    /** A stale PENDING request with its reservation, as RequestBooking left it a day ago. */
    async function staleRequest(): Promise<string> {
      const listingId = randomUUID();
      const id = randomUUID();
      await test.db.query(
        `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)`,
        [listingId, OWNER_ID],
      );
      await test.db.query(
        `INSERT INTO bookings (id, listing_id, renter_id, owner_id, status, period,
           rental_fee, deposit, late_fee_per_day, expires_at)
         VALUES ($1, $2, $3, $4, 'PENDING', tstzrange($5, $6, '[)'), 6000, 30000, 4000, $7)`,
        [id, listingId, randomUUID(), OWNER_ID, START, END, EXPIRED_AT],
      );
      await test.db.query(
        `INSERT INTO calendar_blocks (listing_id, period, kind, booking_id)
         VALUES ($1, tstzrange($2, $3, '[)'), 'RESERVATION', $4)`,
        [listingId, START, END, id],
      );
      return id;
    }

    const stateOf = async (id: string) =>
      (
        (await test.db.query(
          `SELECT b.status,
             (SELECT count(*)::int FROM calendar_blocks c
              WHERE c.booking_id = b.id AND c.released_at IS NULL) AS held,
             (SELECT count(*)::int FROM outbox_events o
              WHERE o.envelope->>'type' = 'booking.expired'
                AND o.envelope->'data'->>'bookingId' = b.id::text) AS events
           FROM bookings b WHERE b.id = $1`,
          [id],
        )) as { status: string; held: number; events: number }[]
      )[0];

    const ids = (rows: BookingRow[]) => rows.map((row) => row.id);

    it('expires a stale request on the schedule and announces it once', async () => {
      const id = await staleRequest();
      const expired = await test.db.transaction((tx) =>
        expireStale(tx, staleBatch(50), now, 'corr-sweep'),
      );
      expect(ids(expired)).toContain(id);
      expect(await stateOf(id)).toEqual({
        status: 'EXPIRED',
        held: 0,
        events: 1,
      });
      const again = await test.db.transaction((tx) =>
        expireStale(tx, staleBatch(50), now, 'corr-sweep'),
      );
      expect(ids(again)).not.toContain(id);
      expect((await stateOf(id)).events).toBe(1);
    });

    it('skips a request a lazy expiry holds, so only the lazy expiry announces it', async () => {
      const id = await staleRequest();
      const changed = gate();
      const finish = gate();
      const lazy = test.db.transaction(async (tx) => {
        const rows = await expireStale(tx, oneBooking(id), now, 'corr-lazy');
        changed.open();
        await finish.wait;
        return rows;
      });
      await changed.wait;
      const swept = await test.db.transaction((tx) =>
        expireStale(tx, staleBatch(50), now, 'corr-sweep'),
      );
      finish.open();
      expect(ids(await lazy)).toEqual([id]);
      expect(ids(swept)).not.toContain(id);
      expect(await stateOf(id)).toEqual({
        status: 'EXPIRED',
        held: 0,
        events: 1,
      });
    });

    it('lets a lazy expiry that waited for the sweeper change nothing', async () => {
      const id = await staleRequest();
      const changed = gate();
      const finish = gate();
      const sweep = test.db.transaction(async (tx) => {
        const rows = await expireStale(tx, staleBatch(50), now, 'corr-sweep');
        changed.open();
        await finish.wait;
        return rows;
      });
      await changed.wait;
      // Blocks on the sweeper's row lock, then finds the booking no longer PENDING.
      const lazy = test.db.transaction((tx) =>
        expireStale(tx, oneBooking(id), now, 'corr-lazy'),
      );
      finish.open();
      expect(ids(await sweep)).toContain(id);
      expect(await lazy).toEqual([]);
      expect((await stateOf(id)).events).toBe(1);
    });
  },
);
