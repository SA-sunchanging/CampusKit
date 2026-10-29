import { NotFoundException } from '@nestjs/common';
import {
  LISTING_ID,
  OWNER_ID,
  RENTER_ID,
  STRANGER_ID,
} from '../testing/fixtures.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { RentalCreationService } from './rental-creation.service.js';
import { RentalQueriesService } from './rental-queries.service.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };
const stranger = { sub: STRANGER_ID, role: 'student' as const };

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'rental queries (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let creation: RentalCreationService;
    let queries: RentalQueriesService;

    beforeAll(async () => {
      test = await createTestDatabase();
      creation = new RentalCreationService(test.db);
      queries = new RentalQueriesService(test.db);
    });

    afterAll(async () => {
      await test?.drop();
    });

    function create(bookingId: string, renterId = RENTER_ID) {
      return creation.create({
        bookingId,
        listingId: LISTING_ID,
        ownerId: OWNER_ID,
        renterId,
        period: { start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' },
        terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
      });
    }

    it('lists by role, newest first, and hides rentals from others', async () => {
      const older = await create('22222222-2222-4222-8222-000000000001');
      const newer = await create('22222222-2222-4222-8222-000000000002');
      const other = await create(
        '22222222-2222-4222-8222-000000000003',
        STRANGER_ID,
      );
      await test.db.query(
        `UPDATE rentals SET created_at = CASE WHEN id = $1
           THEN timestamptz '2026-10-28T05:00:00Z'
           ELSE timestamptz '2026-10-29T05:00:00Z' END`,
        [older.id],
      );
      const mine = await queries.list(renter, 'renter');
      expect(mine.rentals.map((r) => r.id)).toEqual([newer.id, older.id]);
      // newer and other were made at the same time: the larger ID comes first.
      const tied = [other.id, newer.id].sort().reverse();
      const listed = await queries.list(owner, 'owner');
      expect(listed.rentals.map((r) => r.id)).toEqual([...tied, older.id]);
      expect((await queries.list(owner, 'renter')).rentals).toEqual([]);
      expect((await queries.list(stranger, 'renter')).rentals).toHaveLength(1);

      const detail = await queries.get(owner, newer.id);
      expect(detail.pickupCode).toMatch(/^[0-9]{6}$/);
      expect((await queries.get(renter, newer.id)).pickupCode).toBe('');
      await expect(queries.get(stranger, newer.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(queries.getInternal(newer.id)).resolves.toMatchObject({
        id: newer.id,
        status: 'AWAITING_PICKUP',
        closedAt: '',
      });
    });
  },
);
