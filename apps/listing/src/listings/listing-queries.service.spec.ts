import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { CalendarClient } from '../clients/calendar.client.js';
import {
  likePattern,
  ListingQueriesService,
  MAX_DATED_CANDIDATES,
} from './listing-queries.service.js';
import type { Listing } from './listing.entity.js';
import type { ListingsService } from './listings.service.js';

const owner = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'student' as const,
};
const other = {
  sub: '00000000-0000-4000-8000-000000000002',
  role: 'student' as const,
};
const admin = {
  sub: '00000000-0000-4000-8000-000000000009',
  role: 'admin' as const,
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
    findOneBy: vi.fn(),
    findBy: vi.fn(),
  };
  const listingsService = {
    photoUrls: vi.fn().mockResolvedValue(['data:image/jpeg;base64,AAAA']),
  };
  const calendar = { filterAvailable: vi.fn() };
  const service = new ListingQueriesService(
    repo as unknown as Repository<Listing>,
    listingsService as unknown as ListingsService,
    calendar as unknown as CalendarClient,
  );
  return { service, repo, builder, calendar };
}

describe('likePattern', () => {
  it('escapes LIKE wildcards', () => {
    expect(likePattern('100%_off\\')).toBe('%100\\%\\_off\\\\%');
  });
});

describe('ListingQueriesService.search', () => {
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

describe('ListingQueriesService.search with dates', () => {
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

describe('ListingQueriesService.detail', () => {
  it('shows a PUBLISHED listing to a guest, with photos', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(listing());
    const result = await service.detail(id, null);
    expect(result.photos).toHaveLength(1);
  });

  it('shows a DRAFT only to its owner', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(
      listing({ status: 'DRAFT', publishedAt: null }),
    );
    await expect(service.detail(id, owner)).resolves.toMatchObject({
      status: 'DRAFT',
    });
    await expect(service.detail(id, other)).rejects.toThrow(NotFoundException);
    await expect(service.detail(id, null)).rejects.toThrow(NotFoundException);
  });

  it('shows a listing waiting for review to its owner and administrators only', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(
      listing({
        status: 'PENDING_REVIEW',
        publishedAt: null,
        moderationFlags: ['Mentions "gun"'],
      }),
    );
    await expect(service.detail(id, owner)).resolves.toMatchObject({
      status: 'PENDING_REVIEW',
      moderationFlags: ['Mentions "gun"'],
    });
    await expect(service.detail(id, admin)).resolves.toMatchObject({
      status: 'PENDING_REVIEW',
    });
    await expect(service.detail(id, other)).rejects.toThrow(NotFoundException);
    await expect(service.detail(id, null)).rejects.toThrow(NotFoundException);
  });

  it('shows the rejection reason to the owner of a REJECTED listing', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(
      listing({
        status: 'REJECTED',
        publishedAt: null,
        rejectionReason: 'Not allowed on campus',
      }),
    );
    await expect(service.detail(id, owner)).resolves.toMatchObject({
      rejectionReason: 'Not allowed on campus',
    });
    await expect(service.detail(id, other)).rejects.toThrow(NotFoundException);
  });

  it('shows an UNPUBLISHED listing to its owner only', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(listing({ status: 'UNPUBLISHED' }));
    await expect(service.detail(id, owner)).resolves.toMatchObject({
      status: 'UNPUBLISHED',
    });
    await expect(service.detail(id, other)).rejects.toThrow(NotFoundException);
  });

  it('answers 404 for an unknown listing', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.detail(id, owner)).rejects.toThrow(NotFoundException);
  });
});

describe('ListingQueriesService.quote', () => {
  const period = { start: '2026-11-01T17:00:00Z', end: '2026-11-03T17:00:00Z' };

  it('prices a PUBLISHED listing', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(listing());
    await expect(service.quote(id, period)).resolves.toMatchObject({
      ownerId: owner.sub,
      days: 2,
      rentalFee: 7000,
      deposit: 50000,
      lateFeePerDay: 5000,
    });
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'UNPUBLISHED'] as const)(
    'refuses to quote a %s listing',
    async (status) => {
      const { service, repo } = setup();
      repo.findOneBy.mockResolvedValue(listing({ status }));
      await expect(service.quote(id, period)).rejects.toThrow(
        ConflictException,
      );
    },
  );

  it('answers 404 for an unknown listing', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.quote(id, period)).rejects.toThrow(NotFoundException);
  });
});
