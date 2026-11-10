import { ConflictException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import {
  BOOKING_ID,
  NOW,
  OWNER_ID,
  RENTER_ID,
} from '../testing/fake-ledger.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { AuthorizeService, type AuthorizeRequest } from './authorize.js';
import { VoidService } from './void.js';

const fee: AuthorizeRequest = {
  operationId: 'authorize-fee',
  bookingId: BOOKING_ID,
  payerId: RENTER_ID,
  payeeId: OWNER_ID,
  kind: 'FEE',
  amount: 6000,
  requiredUntil: '2026-11-04T17:00:00Z',
};
const voidRequest = { operationId: 'void', bookingId: BOOKING_ID };

/** Runs a service inside a transaction the test commits explicitly. */
function inside(tx: EntityManager): DataSource {
  return {
    transaction: <T>(work: (manager: EntityManager) => Promise<T>) => work(tx),
  } as DataSource;
}

/** Reports the real connection PID before it tries the ledger locks. */
function observeConnection(db: DataSource) {
  let report: (pid: number) => void = () => undefined;
  const pid = new Promise<number>((resolve) => {
    report = resolve;
  });
  const observed = {
    transaction: <T>(work: (manager: EntityManager) => Promise<T>) =>
      db.transaction(async (tx) => {
        const [row] = (await tx.query('SELECT pg_backend_pid() AS pid')) as {
          pid: number;
        }[];
        report(row.pid);
        return work(tx);
      }),
  } as DataSource;
  return { db: observed, pid };
}

async function waitsOnBookingLock(
  db: DataSource,
  pid: number,
): Promise<boolean> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [row] = (await db.query(
      `SELECT EXISTS (SELECT 1 FROM pg_locks
       WHERE pid = $1 AND locktype = 'advisory' AND NOT granted) AS waiting`,
      [pid],
    )) as { waiting: boolean }[];
    if (row.waiting) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'authorize/void ordering (PostgreSQL)',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });
    afterAll(async () => {
      await test?.drop();
    });
    afterEach(async () => {
      await test.db.query('DELETE FROM authorizations');
      await test.db.query('DELETE FROM ledger_entries');
    });

    const holds = () =>
      test.db.query('SELECT status FROM authorizations') as Promise<
        { status: string }[]
      >;

    it('refuses a new hold after an empty void, while the same void remains replayable', async () => {
      const voider = new VoidService(test.db);
      const first = await voider.voidOpen(voidRequest);
      expect(first.voided).toEqual([]);
      await expect(
        new AuthorizeService(test.db).authorize(fee, NOW),
      ).rejects.toThrow('The booking has already been voided');
      await expect(voider.voidOpen(voidRequest)).resolves.toEqual(first);
      expect(await holds()).toEqual([]);
    });

    it('makes an authorization wait for a concurrent empty void, then refuses it', async () => {
      const blocker = test.db.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      const observed = observeConnection(test.db);
      let pending: Promise<unknown> | undefined;
      try {
        await new VoidService(inside(blocker.manager)).voidOpen(voidRequest);
        const result = new AuthorizeService(observed.db)
          .authorize(fee, NOW)
          .then(
            (value) => ({ value }),
            (error: unknown) => ({ error }),
          );
        pending = result;
        expect(await waitsOnBookingLock(test.db, await observed.pid)).toBe(
          true,
        );
        await blocker.commitTransaction();
        expect(await result).toEqual({ error: expect.any(ConflictException) });
        expect(await holds()).toEqual([]);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await pending;
        await blocker.release();
      }
    });

    it('makes a void wait for an uncommitted first hold, then releases that hold', async () => {
      const blocker = test.db.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      const observed = observeConnection(test.db);
      let pending: Promise<unknown> | undefined;
      try {
        await new AuthorizeService(inside(blocker.manager)).authorize(fee, NOW);
        const result = new VoidService(observed.db).voidOpen(voidRequest);
        pending = result;
        expect(await waitsOnBookingLock(test.db, await observed.pid)).toBe(
          true,
        );
        await blocker.commitTransaction();
        expect((await result).voided).toEqual(['FEE']);
        expect(await holds()).toEqual([{ status: 'VOIDED' }]);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await pending;
        await blocker.release();
      }
    });

    it('rejects a return at hold expiry without storing a hold or ledger entry', async () => {
      await expect(
        new AuthorizeService(test.db).authorize(
          { ...fee, requiredUntil: '2026-11-28T05:00:00Z' },
          NOW,
        ),
      ).rejects.toThrow('The authorization must last beyond the rental return');
      expect(await holds()).toEqual([]);
      expect(await test.db.query('SELECT 1 FROM ledger_entries')).toEqual([]);
    });

    it('never extends an expired authorization when the same period-aware request is retried', async () => {
      const authorizer = new AuthorizeService(test.db);
      await authorizer.authorize(fee, NOW);
      await expect(
        authorizer.authorize(fee, new Date('2026-11-28T05:00:00Z')),
      ).rejects.toThrow('The authorization has expired');
      const rows = (await test.db.query(
        'SELECT expires_at FROM authorizations',
      )) as { expires_at: Date }[];
      expect(rows).toEqual([{ expires_at: new Date('2026-11-28T05:00:00Z') }]);
    });
  },
);
