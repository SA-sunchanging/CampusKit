import type { Model } from 'mongoose';
import type { Review } from '../reviews/review.schema.js';
import { averageRating } from './reputation.response.js';
import { ReputationService } from './reputation.service.js';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const RENTER_ID = '33333333-3333-4333-8333-333333333333';
const NEW_ID = '55555555-5555-4555-8555-555555555555';

function setup(totals: { _id: string; sum: number; count: number }[] = []) {
  const aggregate = vi.fn((_pipeline: unknown[]) => ({
    exec: () => Promise.resolve(totals),
  }));
  const service = new ReputationService({
    aggregate,
  } as unknown as Model<Review>);
  return { service, aggregate };
}

describe('averageRating', () => {
  it('is null without reviews', () => {
    expect(averageRating(0, 0)).toBeNull();
  });

  it.each([
    [9, 2, 4.5],
    [13, 3, 4.3],
    [14, 3, 4.7],
    [87, 20, 4.4],
    [5, 1, 5],
  ])('rounds %i / %i to %d', (sum, count, expected) => {
    expect(averageRating(sum, count)).toBe(expected);
  });
});

describe('ReputationService', () => {
  it('sums the ratings of all requested users in one aggregation', async () => {
    const { service, aggregate } = setup();
    await service.summaries([OWNER_ID.toUpperCase(), RENTER_ID]);
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: { revieweeId: { $in: [OWNER_ID, RENTER_ID] } },
    });
  });

  it('answers one summary per distinct user, in the order asked', async () => {
    const { service } = setup([
      { _id: RENTER_ID, sum: 9, count: 2 },
      { _id: OWNER_ID, sum: 4, count: 1 },
    ]);
    await expect(
      service.summaries([OWNER_ID, NEW_ID, RENTER_ID, OWNER_ID.toUpperCase()]),
    ).resolves.toEqual([
      { userId: OWNER_ID, averageRating: 4, reviewCount: 1 },
      { userId: NEW_ID, averageRating: null, reviewCount: 0 },
      { userId: RENTER_ID, averageRating: 4.5, reviewCount: 2 },
    ]);
  });

  it('summarises one user', async () => {
    const { service } = setup([{ _id: OWNER_ID, sum: 13, count: 3 }]);
    await expect(service.summary(OWNER_ID)).resolves.toEqual({
      userId: OWNER_ID,
      averageRating: 4.3,
      reviewCount: 3,
    });
  });

  it('gives a user without reviews no average', async () => {
    const { service } = setup();
    await expect(service.summary(NEW_ID)).resolves.toEqual({
      userId: NEW_ID,
      averageRating: null,
      reviewCount: 0,
    });
  });
});
