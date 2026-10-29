import { ConflictException } from '@nestjs/common';
import {
  BOOKING_ID,
  LISTING_ID,
  OWNER_ID,
  RENTER_ID,
} from '../testing/fixtures.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import {
  type CreateRentalRequest,
  RentalCreationService,
} from './rental-creation.service.js';

const request: CreateRentalRequest = {
  bookingId: BOOKING_ID,
  listingId: LISTING_ID,
  ownerId: OWNER_ID,
  renterId: RENTER_ID,
  period: { start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' },
  terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
};

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'create rental (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let service: RentalCreationService;

    beforeAll(async () => {
      test = await createTestDatabase();
      service = new RentalCreationService(test.db);
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM rentals`);
    });

    const count = async () =>
      Number(
        (
          (await test.db.query(`SELECT count(*) AS n FROM rentals`)) as {
            n: string;
          }[]
        )[0].n,
      );

    it('stores the rental with its codes and returns it again on a retry', async () => {
      const first = await service.create(request);
      expect(first).toMatchObject({
        bookingId: BOOKING_ID,
        status: 'AWAITING_PICKUP',
      });
      await expect(service.create({ ...request })).resolves.toEqual(first);
      const [row] = (await test.db.query(
        `SELECT pickup_code, return_code, period_start FROM rentals`,
      )) as { pickup_code: string; return_code: string; period_start: Date }[];
      expect(row.pickup_code).toMatch(/^[0-9]{6}$/);
      expect(row.return_code).toMatch(/^[0-9]{6}$/);
      expect(row.period_start).toEqual(new Date('2026-11-01T17:00:00Z'));
      expect(await count()).toBe(1);
    });

    it('opens one rental when the same booking arrives concurrently', async () => {
      const replies = await Promise.all(
        Array.from({ length: 5 }, () => service.create({ ...request })),
      );
      expect(new Set(replies.map((reply) => reply.id)).size).toBe(1);
      expect(await count()).toBe(1);
    });

    it('answers 409 for the same booking with other terms', async () => {
      await service.create(request);
      await expect(
        service.create({
          ...request,
          terms: { ...request.terms, deposit: 20000 },
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await count()).toBe(1);
    });

    it('accepts the same period written in another time zone', async () => {
      const first = await service.create(request);
      const again = await service.create({
        ...request,
        period: {
          start: '2026-11-02T00:00:00.000+07:00',
          end: '2026-11-05T00:00:00+07:00',
        },
      });
      expect(again.id).toBe(first.id);
    });
  },
);
