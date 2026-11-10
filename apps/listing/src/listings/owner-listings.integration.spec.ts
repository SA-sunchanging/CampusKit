import { DataSource } from 'typeorm';
import type { ReviewClient } from '../clients/review.client.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { ListingQueriesService } from './listing-queries.service.js';
import { LISTING_STATUSES, type ListingStatus } from './listing-options.js';
import { Listing } from './listing.entity.js';
import type { ListingsService } from './listings.service.js';

const owner = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'student' as const,
};
const other = {
  sub: '00000000-0000-4000-8000-000000000002',
  role: 'student' as const,
};
const adminId = '00000000-0000-4000-8000-000000000009';
const FULL_PHOTO = 'data:image/jpeg;base64,FULL_PHOTOGRAPH';
const listingId = (index: number) =>
  `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'My Listings owner isolation and pagination (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let orm: DataSource;
    let service: ListingQueriesService;
    const photoUrls = vi
      .fn()
      .mockRejectedValue(new Error('Photos unavailable'));
    const reputations = vi
      .fn()
      .mockRejectedValue(new Error('Review unavailable'));

    beforeAll(async () => {
      test = await createTestDatabase();
      // Reuse the helper's migrated schema; this connection supplies entity metadata for reads.
      orm = new DataSource({
        type: 'postgres',
        url: process.env.TEST_DATABASE_URL,
        schema: test.schema,
        entities: [Listing],
        installExtensions: false,
        extra: { options: `-c search_path=${test.schema}` },
      });
      await orm.initialize();
      service = new ListingQueriesService(
        orm.getRepository(Listing),
        { photoUrls } as unknown as ListingsService,
        { reputations } as unknown as ReviewClient,
      );
      for (const [index, status] of LISTING_STATUSES.entries()) {
        // The first two owned rows share a date, exercising the ID tiebreaker.
        await insert(
          index + 1,
          owner.sub,
          status,
          `2026-10-${29 - Math.max(0, index - 1)}T00:00:00Z`,
        );
        await insert(index + 101, other.sub, status, '2026-11-01T00:00:00Z');
      }
      await test.db.query(
        `INSERT INTO listing_photos (listing_id, position, data_url) VALUES ($1, 0, $2)`,
        [listingId(1), FULL_PHOTO],
      );
    });

    afterAll(async () => {
      if (orm?.isInitialized) await orm.destroy();
      await test?.drop();
    });

    async function insert(
      index: number,
      ownerId: string,
      status: ListingStatus,
      createdAt: string,
    ) {
      const wasPublished = status === 'PUBLISHED' || status === 'UNPUBLISHED';
      const rejected = status === 'REJECTED';
      await test.db.query(
        `INSERT INTO listings (
          id, owner_id, owner_name, status, title, category, description, condition,
          replacement_value, daily_rate, deposit, late_fee_per_day, max_rental_days,
          pickup_locations, created_at, published_at, unpublished_at, rejection_reason,
          reviewed_by, reviewed_at, publish_error
        ) VALUES ($1, $2, 'Owner', $3, $4, 'BOOKS', 'Private description', 'GOOD',
          10000, 1000, 2000, 1000, 7, '{ENGINEERING}', $5, $6, $7, $8, $9, $10, $11)`,
        [
          listingId(index),
          ownerId,
          status,
          `Item ${index}`,
          createdAt,
          wasPublished ? createdAt : null,
          status === 'UNPUBLISHED' ? createdAt : null,
          rejected ? 'Not approved' : null,
          rejected ? adminId : null,
          rejected ? createdAt : null,
          status === 'DRAFT' ? 'Calendar unavailable' : null,
        ],
      );
    }

    it("returns every own status without another owner's public or private records", async () => {
      const page = await service.mine(owner, { page: 1, pageSize: 50 });
      expect(page.total).toBe(5);
      expect(page.items.map((item) => item.id)).toEqual(
        [1, 2, 3, 4, 5].map(listingId),
      );
      expect(page.items.map((item) => item.status)).toEqual(LISTING_STATUSES);
      const othersPage = await service.mine(other, { page: 1, pageSize: 50 });
      expect(othersPage.total).toBe(5);
      expect(othersPage.items.map((item) => item.id)).toEqual(
        [101, 102, 103, 104, 105].map(listingId),
      );
    });

    it('orders newest first with stable ties, paginates, and counts only the owner', async () => {
      const first = await service.mine(owner, { page: 1, pageSize: 2 });
      const second = await service.mine(owner, { page: 2, pageSize: 2 });
      const last = await service.mine(owner, { page: 3, pageSize: 2 });
      const pastLast = await service.mine(owner, { page: 4, pageSize: 2 });
      expect(first.items.map((item) => item.id)).toEqual([1, 2].map(listingId));
      expect(second.items.map((item) => item.id)).toEqual(
        [3, 4].map(listingId),
      );
      expect(last.items.map((item) => item.id)).toEqual([listingId(5)]);
      for (const page of [first, second, last, pastLast])
        expect(page.total).toBe(5);
      expect(second).toMatchObject({ page: 2, pageSize: 2 });
      expect(pastLast.items).toEqual([]);
    });

    it('returns summaries while full photographs and reputation are unavailable', async () => {
      const page = await service.mine(owner, { page: 1, pageSize: 20 });
      expect(page.items[0]).toEqual({
        id: listingId(1),
        title: 'Item 1',
        category: 'BOOKS',
        status: 'DRAFT',
        dailyRate: 1000,
        thumbnail: null,
        publishError: 'Calendar unavailable',
        rejectionReason: null,
        createdAt: new Date('2026-10-29T00:00:00Z'),
      });
      expect(JSON.stringify(page)).not.toContain(FULL_PHOTO);
      expect(JSON.stringify(page)).not.toContain('Private description');
      expect(photoUrls).not.toHaveBeenCalled();
      expect(reputations).not.toHaveBeenCalled();
    });
  },
);
