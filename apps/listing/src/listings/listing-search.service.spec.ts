import { ServiceUnavailableException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { CalendarClient } from '../clients/calendar.client.js';
import type { ReviewClient } from '../clients/review.client.js';
import {
  likePattern,
  ListingSearchService,
  MAX_DATED_CANDIDATES,
} from './listing-search.service.js';
import type { Listing } from './listing.entity.js';

const owner = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'student' as const,
};
const other = {
  sub: '00000000-0000-4000-8000-000000000002',
  role: 'student' as const,
};
const id = '11111111-1111-4111-8111-111111111111';

const listing = (fields: Partial<Listing> = {}) =>
  ({
    id,
    ownerId: owner.sub,
    status: 'PUBLISHED',
    title: 'Badminton racket',
    dailyRate: 3500,
    deposit: 50000,
    lateFeePerDay: 5000,
    maxRentalDays: 5,
    publishedAt: new Date('2026-10-28T00:00:00Z'),
    ...fields,
  }) as Listing;

function setup() {
  const builder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[listing()], 41]),
    getMany: vi.fn().mockResolvedValue([]),
  };
  const repo = {
    createQueryBuilder: vi.fn().mockReturnValue(builder),
    findBy: vi.fn(),
  };
  const calendar = { filterAvailable: vi.fn() };
  const reviews = { reputations: vi.fn().mockResolvedValue(new Map()) };
  const service = new ListingSearchService(
    repo as unknown as Repository<Listing>,
    calendar as unknown as CalendarClient,
    reviews as unknown as ReviewClient,
  );
  return { service, repo, builder, calendar, reviews };
}

describe('likePattern', () => {
  it('escapes LIKE wildcards', () => {
    expect(likePattern('100%_off\\')).toBe('%100\\%\\_off\\\\%');
  });
});

describe('ListingSearchService.search', () => {
  it('returns one page of PUBLISHED listings with the total', async () => {
    const { service, builder } = setup();
    const result = await service.search({ page: 3, pageSize: 20 }, 'corr-1');
    expect(builder.where).toHaveBeenCalledWith('listing.status = :status', {
      status: 'PUBLISHED',
    });
    expect(builder.andWhere).not.toHaveBeenCalled();
    expect(builder.skip).toHaveBeenCalledWith(40);
    expect(builder.take).toHaveBeenCalledWith(20);
    expect(result).toMatchObject({ total: 41, page: 3, pageSize: 20 });
    expect(result.items[0]).toMatchObject({ id, title: 'Badminton racket' });
  });

  it('filters by category and keyword', async () => {
    const { service, builder } = setup();
    await service.search(
      {
        q: 'racket',
        category: 'SPORTS',
        location: 'ENGINEERING',
        page: 1,
        pageSize: 20,
      },
      'corr-1',
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'listing.category = :category',
      {
        category: 'SPORTS',
      },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      { pattern: '%racket%' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      ':location = ANY(listing.pickupLocations)',
      { location: 'ENGINEERING' },
    );
  });

  it('does not call Booking without dates', async () => {
    const { service, calendar } = setup();
    await service.search({ page: 1, pageSize: 20 }, 'corr-1');
    expect(calendar.filterAvailable).not.toHaveBeenCalled();
  });
});

describe('ListingSearchService.search with dates', () => {
  const dated = {
    start: '2026-11-02T00:00:00+07:00',
    end: '2026-11-04T00:00:00+07:00',
  };
  const ids = ['a', 'b', 'c', 'd', 'e'].map(
    (letter) => `${letter.repeat(8)}-0000-4000-8000-000000000000`,
  );

  function datedSetup(free: string[]) {
    const context = setup();
    context.builder.getMany.mockResolvedValue(
      ids.map((each) => ({ id: each })),
    );
    context.calendar.filterAvailable.mockResolvedValue(free);
    context.repo.findBy.mockImplementation(() =>
      Promise.resolve(free.map((each) => listing({ id: each })).reverse()),
    );
    return context;
  }

  it('asks Booking once about at most 200 matches, in UTC', async () => {
    const { service, builder, calendar } = datedSetup([]);
    await service.search({ ...dated, page: 1, pageSize: 20 }, 'corr-1');
    expect(builder.limit).toHaveBeenCalledWith(MAX_DATED_CANDIDATES);
    expect(MAX_DATED_CANDIDATES).toBe(200);
    expect(calendar.filterAvailable).toHaveBeenCalledTimes(1);
    expect(calendar.filterAvailable).toHaveBeenCalledWith(
      ids,
      { start: '2026-11-01T17:00:00.000Z', end: '2026-11-03T17:00:00.000Z' },
      'corr-1',
    );
    expect(builder.getManyAndCount).not.toHaveBeenCalled();
  });

  it('pages through the free listings in memory, keeping their order', async () => {
    const free = [ids[4], ids[1], ids[3]];
    const { service, repo } = datedSetup(free);
    const result = await service.search(
      { ...dated, page: 2, pageSize: 2 },
      'corr-1',
    );
    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.id)).toEqual([ids[3]]);
    expect(repo.findBy).toHaveBeenCalledTimes(1);
    const first = await service.search(
      { ...dated, page: 1, pageSize: 2 },
      'corr-1',
    );
    expect(first.items.map((item) => item.id)).toEqual([ids[4], ids[1]]);
  });

  it('skips Booking when nothing matches and the database for an empty page', async () => {
    const { service, builder, calendar, repo } = datedSetup([ids[0]]);
    builder.getMany.mockResolvedValue([]);
    await expect(
      service.search({ ...dated, page: 1, pageSize: 20 }, 'corr-1'),
    ).resolves.toMatchObject({ items: [], total: 0 });
    expect(calendar.filterAvailable).not.toHaveBeenCalled();
    builder.getMany.mockResolvedValue([{ id: ids[0] }]);
    await expect(
      service.search({ ...dated, page: 5, pageSize: 20 }, 'corr-1'),
    ).resolves.toMatchObject({ items: [], total: 1 });
    expect(repo.findBy).not.toHaveBeenCalled();
  });

  it('fails with 503 when Booking is down', async () => {
    const { service, calendar } = datedSetup([]);
    calendar.filterAvailable.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    await expect(
      service.search({ ...dated, page: 1, pageSize: 20 }, 'corr-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('ListingSearchService owner reputation', () => {
  it('adds each owner rating to a page with one Review call', async () => {
    const { service, builder, reviews } = setup();
    builder.getManyAndCount.mockResolvedValue([
      [
        listing(),
        listing({ id: 'second', ownerId: other.sub }),
        listing({ id: 'third' }),
      ],
      3,
    ]);
    reviews.reputations.mockResolvedValue(
      new Map([[owner.sub, { ownerRating: 4.5, ownerReviewCount: 12 }]]),
    );
    const result = await service.search({ page: 1, pageSize: 20 }, 'corr-1');
    expect(reviews.reputations).toHaveBeenCalledTimes(1);
    expect(reviews.reputations).toHaveBeenCalledWith(
      [owner.sub, other.sub, owner.sub],
      'corr-1',
    );
    expect(
      result.items.map(({ ownerRating, ownerReviewCount }) => [
        ownerRating,
        ownerReviewCount,
      ]),
    ).toEqual([
      [4.5, 12],
      [null, 0],
      [4.5, 12],
    ]);
  });
});
