import { ConflictException } from '@nestjs/common';
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
import { type AuthorizeRequest, AuthorizeService } from './authorize.js';

const fee: AuthorizeRequest = {
  operationId: `booking:${BOOKING_ID}:authorize-fee`,
  bookingId: BOOKING_ID,
  payerId: RENTER_ID,
  payeeId: OWNER_ID,
  kind: 'FEE',
  amount: 6000,
};

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'authorize (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let service: AuthorizeService;

    beforeAll(async () => {
      test = await createTestDatabase();
      service = new AuthorizeService(test.db);
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM authorizations`);
      await test.db.query(`DELETE FROM ledger_entries`);
    });

    const count = async (table: string) =>
      Number(
        (
          (await test.db.query(`SELECT count(*) AS n FROM ${table}`)) as {
            n: string;
          }[]
        )[0].n,
      );

    it('stores one hold and one ledger entry for a repeated request', async () => {
      const first = await service.authorize(fee, NOW);
      const again = await service.authorize({ ...fee }, NOW);
      expect(again).toEqual(first);
      expect(first.status).toBe('AUTHORIZED');
      expect(await count('authorizations')).toBe(1);
      expect(await count('ledger_entries')).toBe(1);
      const [row] = (await test.db.query(
        `SELECT expires_at FROM authorizations`,
      )) as { expires_at: Date }[];
      expect(row.expires_at).toEqual(new Date('2026-11-28T05:00:00Z'));
    });

    it('authorizes once when the same request arrives concurrently', async () => {
      const replies = await Promise.all(
        Array.from({ length: 5 }, () => service.authorize({ ...fee }, NOW)),
      );
      expect(new Set(replies.map((reply) => reply.id)).size).toBe(1);
      expect(await count('authorizations')).toBe(1);
      expect(await count('ledger_entries')).toBe(1);
    });

    it('answers 409 when the operation ID is reused for another amount', async () => {
      await service.authorize(fee, NOW);
      await expect(
        service.authorize({ ...fee, amount: 7000 }, NOW),
      ).rejects.toThrow('operationId was already used for a different request');
      expect(await count('authorizations')).toBe(1);
    });

    it('keeps one hold per kind when two operation IDs race', async () => {
      const results = await Promise.allSettled([
        service.authorize({ ...fee, operationId: 'a' }, NOW),
        service.authorize({ ...fee, operationId: 'b' }, NOW),
      ]);
      const refused = results.filter((result) => result.status === 'rejected');
      expect(refused).toHaveLength(1);
      expect((refused[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
      expect(await count('authorizations')).toBe(1);
      expect(await count('ledger_entries')).toBe(1);
    });

    it('holds the fee and the deposit side by side', async () => {
      await service.authorize(fee, NOW);
      await service.authorize(
        { ...fee, operationId: 'deposit', kind: 'DEPOSIT', amount: 30000 },
        NOW,
      );
      expect(await count('authorizations')).toBe(2);
    });
  },
);
