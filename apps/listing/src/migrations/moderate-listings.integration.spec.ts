import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';

const owner = '00000000-0000-4000-8000-000000000001';
const admin = '00000000-0000-4000-8000-000000000009';
const now = '2026-10-29T05:00:00Z';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'ModerateListings migration',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM listings`);
    });

    function insert(fields: Record<string, unknown> = {}): Promise<unknown> {
      const row = {
        owner_id: owner,
        owner_name: 'Somchai Jaidee',
        title: 'Camera',
        category: 'ELECTRONICS',
        description: 'Mirrorless camera body.',
        condition: 'GOOD',
        replacement_value: 2_000_000,
        daily_rate: 30000,
        deposit: 500000,
        late_fee_per_day: 30000,
        max_rental_days: 7,
        pickup_locations: ['ENGINEERING'],
        status: 'DRAFT',
        ...fields,
      };
      const columns = Object.keys(row);
      return test.db.query(
        `INSERT INTO listings (${columns.join(', ')})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
        Object.values(row),
      );
    }

    it('accepts a listing waiting for review with its flags', async () => {
      await insert({
        status: 'PENDING_REVIEW',
        moderation_flags: ['Replacement value is 10,000 THB or more'],
      });
      const [row] = (await test.db.query(
        `SELECT moderation_flags FROM listings`,
      )) as { moderation_flags: string[] }[];
      expect(row.moderation_flags).toEqual([
        'Replacement value is 10,000 THB or more',
      ]);
    });

    it('defaults the flags to none', async () => {
      await insert();
      const [row] = (await test.db.query(
        `SELECT moderation_flags FROM listings`,
      )) as { moderation_flags: string[] }[];
      expect(row.moderation_flags).toEqual([]);
    });

    it('rejects an unknown status', async () => {
      await expect(insert({ status: 'ARCHIVED' })).rejects.toThrow(
        /listings_status_check/,
      );
    });

    it('keeps published_at on an UNPUBLISHED listing', async () => {
      await insert({
        status: 'UNPUBLISHED',
        published_at: now,
        unpublished_at: now,
      });
      await expect(
        insert({ status: 'UNPUBLISHED', unpublished_at: now }),
      ).rejects.toThrow(/listings_published_check/);
    });

    it('requires unpublished_at exactly on an UNPUBLISHED listing', async () => {
      await expect(
        insert({ status: 'PUBLISHED', published_at: now, unpublished_at: now }),
      ).rejects.toThrow(/listings_unpublished_check/);
    });

    it('refuses published_at on a listing waiting for review', async () => {
      await expect(
        insert({ status: 'PENDING_REVIEW', published_at: now }),
      ).rejects.toThrow(/listings_published_check/);
    });

    it('requires a reason and a reviewer on a REJECTED listing', async () => {
      await insert({
        status: 'REJECTED',
        rejection_reason: 'Not allowed on campus',
        reviewed_by: admin,
        reviewed_at: now,
      });
      await expect(
        insert({ status: 'REJECTED', reviewed_by: admin, reviewed_at: now }),
      ).rejects.toThrow(/listings_rejected_check/);
      await expect(
        insert({ status: 'REJECTED', rejection_reason: 'No' }),
      ).rejects.toThrow(/listings_rejected_check/);
    });

    it('refuses an empty rejection reason', async () => {
      await expect(
        insert({
          status: 'REJECTED',
          rejection_reason: '',
          reviewed_by: admin,
          reviewed_at: now,
        }),
      ).rejects.toThrow(/listings_rejection_reason_check/);
    });

    it('sets the reviewer and review time together', async () => {
      await expect(
        insert({ status: 'PUBLISHED', published_at: now, reviewed_by: admin }),
      ).rejects.toThrow(/listings_reviewed_check/);
    });
  },
);
