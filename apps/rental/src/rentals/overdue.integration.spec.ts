import { randomUUID } from 'node:crypto';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { flagOverdue, remindEnding } from './overdue.js';
import type { RentalStatus } from './rental.entity.js';
import type { RentalRow } from './rental.row.js';

const DAY = 24 * 60 * 60 * 1000;
const START = '2026-11-01T17:00:00Z';
const END = '2026-11-04T17:00:00Z';
/** Twelve hours before the period ends: inside a one-day lead. */
const beforeEnd = new Date('2026-11-04T05:00:00Z');
/** An hour after the period ends. */
const afterEnd = new Date('2026-11-04T18:00:00Z');

/** A promise with its resolve function, to hold a transaction open. */
function gate(): { wait: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'reminders and overdue rentals (PostgreSQL)',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM rentals`);
      await test.db.query(`DELETE FROM outbox_events`);
    });

    /** A rental in status for the period START to END, as pickup left it. */
    async function rental(status: RentalStatus = 'ACTIVE'): Promise<string> {
      const [row] = (await test.db.query(
        `INSERT INTO rentals (booking_id, listing_id, owner_id, renter_id,
           period_start, period_end, rental_fee, deposit, late_fee_per_day,
           status, pickup_code, return_code)
         VALUES ($1, $2, $3, $4, $5, $6, 6000, 30000, 4000, $7, '012345', '987654')
         RETURNING id`,
        [
          randomUUID(),
          randomUUID(),
          randomUUID(),
          randomUUID(),
          START,
          END,
          status,
        ],
      )) as { id: string }[];
      return row.id;
    }

    const stateOf = async (id: string) =>
      (
        (await test.db.query(
          `SELECT r.reminder_sent_at, r.overdue_at,
             (SELECT count(*)::int FROM outbox_events o
              WHERE o.envelope->>'type' = 'rental.reminded'
                AND o.envelope->'data'->>'rentalId' = r.id::text) AS reminded,
             (SELECT count(*)::int FROM outbox_events o
              WHERE o.envelope->>'type' = 'rental.overdue'
                AND o.envelope->'data'->>'rentalId' = r.id::text) AS overdue
           FROM rentals r WHERE r.id = $1`,
          [id],
        )) as {
          reminder_sent_at: Date | null;
          overdue_at: Date | null;
          reminded: number;
          overdue: number;
        }[]
      )[0];

    const remind = (now: Date, correlationId = 'corr-sweep') =>
      test.db.transaction((tx) => remindEnding(tx, now, DAY, correlationId));
    const flag = (now: Date, correlationId = 'corr-sweep') =>
      test.db.transaction((tx) => flagOverdue(tx, now, correlationId));
    const ids = (rows: RentalRow[]) => rows.map((row) => row.id);

    it('reminds the renter once when the period ends within the lead', async () => {
      const id = await rental();
      expect(ids(await remind(new Date('2026-11-03T16:59:59Z')))).toEqual([]);
      expect(ids(await remind(beforeEnd))).toEqual([id]);
      expect(ids(await remind(beforeEnd))).toEqual([]);
      expect(await stateOf(id)).toEqual({
        reminder_sent_at: beforeEnd,
        overdue_at: null,
        reminded: 1,
        overdue: 0,
      });
    });

    it.each(['AWAITING_PICKUP', 'SETTLEMENT_PENDING', 'CLOSED', 'CANCELLED'])(
      'leaves a %s rental alone',
      async (status) => {
        const id = await rental(status as RentalStatus);
        expect(await remind(beforeEnd)).toEqual([]);
        expect(await flag(afterEnd)).toEqual([]);
        expect(await stateOf(id)).toMatchObject({ reminded: 0, overdue: 0 });
      },
    );

    it('flags an ACTIVE rental overdue once its period has ended, and never reminds it afterwards', async () => {
      const id = await rental();
      expect(ids(await flag(new Date('2026-11-04T16:59:59Z')))).toEqual([]);
      expect(ids(await flag(new Date(END)))).toEqual([id]);
      expect(ids(await flag(afterEnd))).toEqual([]);
      expect(ids(await remind(afterEnd))).toEqual([]);
      expect(await stateOf(id)).toEqual({
        reminder_sent_at: null,
        overdue_at: new Date(END),
        reminded: 0,
        overdue: 1,
      });
    });

    it('rolls the flag back with its event when the transaction fails', async () => {
      const id = await rental();
      await expect(
        test.db.transaction(async (tx) => {
          await flagOverdue(tx, afterEnd, 'corr-sweep');
          throw new Error('crash after the event');
        }),
      ).rejects.toThrow('crash');
      expect(await stateOf(id)).toMatchObject({ overdue_at: null, overdue: 0 });
      expect(ids(await flag(afterEnd))).toEqual([id]);
    });

    it('lets two concurrent sweepers announce each rental once', async () => {
      const id = await rental();
      const changed = gate();
      const finish = gate();
      const first = test.db.transaction(async (tx) => {
        const rows = await flagOverdue(tx, afterEnd, 'corr-a');
        changed.open();
        await finish.wait;
        return rows;
      });
      await changed.wait;
      // The second sweeper skips the row the first one holds.
      const second = await flag(afterEnd, 'corr-b');
      finish.open();
      expect(ids(await first)).toEqual([id]);
      expect(second).toEqual([]);
      // Once the first commits, the row no longer matches.
      expect(await flag(afterEnd, 'corr-c')).toEqual([]);
      expect(await stateOf(id)).toMatchObject({ overdue: 1 });
    });

    it('does not remind a rental a concurrent sweeper has just reminded', async () => {
      const id = await rental();
      const changed = gate();
      const finish = gate();
      const first = test.db.transaction(async (tx) => {
        const rows = await remindEnding(tx, beforeEnd, DAY, 'corr-a');
        changed.open();
        await finish.wait;
        return rows;
      });
      await changed.wait;
      const second = await remind(beforeEnd, 'corr-b');
      finish.open();
      expect(ids(await first)).toEqual([id]);
      expect(second).toEqual([]);
      expect(await stateOf(id)).toMatchObject({ reminded: 1 });
    });
  },
);
