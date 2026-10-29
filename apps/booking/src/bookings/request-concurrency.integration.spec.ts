import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import type { IdentityClient } from '../clients/identity.client.js';
import type { ListingClient } from '../clients/listing.client.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { BookingsService } from './bookings.service.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-29T05:00:00Z');
const call = { correlationId: 'corr-concurrency' };
/** Whole Bangkok days: 2-5 Nov, and 3-6 Nov, which overlaps it. */
const first = { start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' };
const overlapping = {
  start: '2026-11-02T17:00:00Z',
  end: '2026-11-05T17:00:00Z',
};
const RENTERS = 20;

function rpcCode(err: unknown): number | undefined {
  if (!(err instanceof RpcException)) {
    return undefined;
  }
  return (err.getError() as { code?: number }).code;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'booking requests under concurrency (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let service: BookingsService;
    let listingId: string;

    beforeAll(async () => {
      test = await createTestDatabase();
      const identity = {
        requireBooker: () => Promise.resolve(),
      } as unknown as IdentityClient;
      const listing = {
        quote: (id: string) =>
          Promise.resolve({
            listingId: id,
            ownerId: OWNER_ID,
            days: 3,
            rentalFee: 6000,
            deposit: 30000,
            lateFeePerDay: 4000,
          }),
      } as unknown as ListingClient;
      service = new BookingsService(test.db, identity, listing);
    });

    afterAll(async () => {
      await test?.drop();
    });

    beforeEach(async () => {
      listingId = randomUUID();
      await test.db.query(
        `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)`,
        [listingId, OWNER_ID],
      );
    });

    const renter = () => ({ sub: randomUUID(), role: 'student' as const });
    const count = async (sql: string, params: unknown[]) =>
      ((await test.db.query(sql, params)) as { n: number }[])[0].n;

    it('lets exactly one of many overlapping requests reserve the dates', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: RENTERS }, (_, i) =>
          service.request(
            renter(),
            listingId,
            i % 2 === 0 ? first : overlapping,
            call,
            now,
          ),
        ),
      );
      const won = results.filter((r) => r.status === 'fulfilled');
      const lost = results.filter((r) => r.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost.map((r) => rpcCode(r.reason))).toEqual(
        Array.from({ length: RENTERS - 1 }, () => status.ALREADY_EXISTS),
      );
      expect(
        await count(
          `SELECT count(*)::int AS n FROM bookings WHERE listing_id = $1`,
          [listingId],
        ),
      ).toBe(1);
      expect(
        await count(
          `SELECT count(*)::int AS n FROM calendar_blocks
           WHERE listing_id = $1 AND released_at IS NULL`,
          [listingId],
        ),
      ).toBe(1);
      expect(
        await count(
          `SELECT count(*)::int AS n FROM outbox_events
           WHERE envelope->'data'->>'bookingId' = $1`,
          [(won[0] as PromiseFulfilledResult<{ id: string }>).value.id],
        ),
      ).toBe(1);
    });

    it('keeps one renter within the open-request limit when requests race', async () => {
      const same = renter();
      const days = Array.from({ length: 8 }, (_, i) => ({
        start: new Date(Date.parse(first.start) + i * 86_400_000).toISOString(),
        end: new Date(
          Date.parse(first.start) + (i + 1) * 86_400_000,
        ).toISOString(),
      }));
      const results = await Promise.allSettled(
        days.map(async (period) => {
          const listing = randomUUID();
          await test.db.query(
            `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)`,
            [listing, OWNER_ID],
          );
          return service.request(same, listing, period, call, now);
        }),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
      expect(
        results
          .filter((r) => r.status === 'rejected')
          .map((r) => rpcCode(r.reason)),
      ).toEqual([
        status.FAILED_PRECONDITION,
        status.FAILED_PRECONDITION,
        status.FAILED_PRECONDITION,
      ]);
    });

    it('frees the dates of an expired request for the next renter', async () => {
      const stale = await service.request(
        renter(),
        listingId,
        first,
        call,
        now,
      );
      const later = new Date(stale.expires_at.getTime() + 1);
      const next = await service.request(
        renter(),
        listingId,
        overlapping,
        call,
        later,
      );
      expect(next.status).toBe('PENDING');
      const [old] = (await test.db.query(
        `SELECT status FROM bookings WHERE id = $1`,
        [stale.id],
      )) as { status: string }[];
      expect(old.status).toBe('EXPIRED');
    });
  },
);
