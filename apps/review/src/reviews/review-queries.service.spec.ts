import type { AuthUser } from '@app/common';
import { Types, type Model } from 'mongoose';
import { ReputationResponse } from '../reputation/reputation.response.js';
import type { ReputationService } from '../reputation/reputation.service.js';
import { ReviewQueriesService } from './review-queries.service.js';
import type { Review, ReviewRecord } from './review.schema.js';

const RENTAL_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const RENTER_ID = '33333333-3333-4333-8333-333333333333';

function record(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    _id: new Types.ObjectId(),
    rentalId: RENTAL_ID,
    listingId: '44444444-4444-4444-8444-444444444444',
    reviewerId: RENTER_ID,
    revieweeId: OWNER_ID,
    reviewerRole: 'renter',
    rating: 4,
    createdAt: new Date('2026-10-29T08:00:00.000Z'),
    ...overrides,
  };
}

/** A Mongoose query stand-in: every builder method returns itself; exec resolves the result. */
function query(result: unknown) {
  const chain = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn(() => chain),
    exec: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function setup(rows: ReviewRecord[] = [record()], ratingSum = 4, count = 1) {
  const finds = query(rows);
  const model = { find: vi.fn((_filter: unknown) => finds) };
  const summary = vi.fn((userId: string) =>
    Promise.resolve(ReputationResponse.of(userId, ratingSum, count)),
  );
  const service = new ReviewQueriesService(
    model as unknown as Model<Review>,
    { summary } as unknown as ReputationService,
  );
  return { service, model, finds, summary };
}

describe('ReviewQueriesService', () => {
  describe('received', () => {
    it("pages the user's received reviews, newest first", async () => {
      const { service, model, finds, summary } = setup([record()], 90, 21);
      const result = await service.received({
        userId: OWNER_ID.toUpperCase(),
        page: 2,
        pageSize: 10,
      });
      expect(model.find).toHaveBeenCalledWith({ revieweeId: OWNER_ID });
      expect(summary).toHaveBeenCalledWith(OWNER_ID.toUpperCase());
      expect(finds.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(finds.skip).toHaveBeenCalledWith(10);
      expect(finds.limit).toHaveBeenCalledWith(10);
      expect(result).toMatchObject({
        total: 21,
        averageRating: 4.3,
        page: 2,
        pageSize: 10,
      });
      expect(result.items[0]).toMatchObject({ rating: 4, comment: '' });
    });
  });

  describe('ofRental', () => {
    it('finds only reviews the caller wrote or received', async () => {
      const { service, model } = setup();
      const caller: AuthUser = { sub: OWNER_ID, role: 'student' };
      const result = await service.ofRental(caller, RENTAL_ID.toUpperCase());
      expect(model.find).toHaveBeenCalledWith({
        rentalId: RENTAL_ID,
        $or: [{ reviewerId: OWNER_ID }, { revieweeId: OWNER_ID }],
      });
      expect(result.items).toHaveLength(1);
    });
  });
});
