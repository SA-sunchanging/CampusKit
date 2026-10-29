import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ReviewClient } from '../clients/review.client.js';
import { ListingQueriesService } from './listing-queries.service.js';
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
  const repo = {
    findOneBy: vi.fn(),
  };
  const listingsService = {
    photoUrls: vi.fn().mockResolvedValue(['data:image/jpeg;base64,AAAA']),
  };
  const reviews = { reputations: vi.fn().mockResolvedValue(new Map()) };
  const service = new ListingQueriesService(
    repo as unknown as Repository<Listing>,
    listingsService as unknown as ListingsService,
    reviews as unknown as ReviewClient,
  );
  return { service, repo, reviews };
}

describe('ListingQueriesService.detail', () => {
  it('shows the owner rating on the detail page, or none when Review has nothing', async () => {
    const { service, repo, reviews } = setup();
    repo.findOneBy.mockResolvedValue(listing());
    await expect(service.detail(id, null, 'corr-1')).resolves.toMatchObject({
      ownerRating: null,
      ownerReviewCount: 0,
    });
    reviews.reputations.mockResolvedValue(
      new Map([[owner.sub, { ownerRating: 3, ownerReviewCount: 1 }]]),
    );
    await expect(service.detail(id, null, 'corr-1')).resolves.toMatchObject({
      ownerRating: 3,
      ownerReviewCount: 1,
    });
    expect(reviews.reputations).toHaveBeenCalledWith([owner.sub], 'corr-1');
  });

  it('shows a PUBLISHED listing to a guest, with photos', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(listing());
    const result = await service.detail(id, null, 'corr-1');
    expect(result.photos).toHaveLength(1);
  });

  it('shows a DRAFT only to its owner', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(
      listing({ status: 'DRAFT', publishedAt: null }),
    );
    await expect(service.detail(id, owner, 'corr-1')).resolves.toMatchObject({
      status: 'DRAFT',
    });
    await expect(service.detail(id, other, 'corr-1')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.detail(id, null, 'corr-1')).rejects.toThrow(
      NotFoundException,
    );
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
    await expect(service.detail(id, owner, 'corr-1')).resolves.toMatchObject({
      status: 'PENDING_REVIEW',
      moderationFlags: ['Mentions "gun"'],
    });
    await expect(service.detail(id, admin, 'corr-1')).resolves.toMatchObject({
      status: 'PENDING_REVIEW',
    });
    await expect(service.detail(id, other, 'corr-1')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.detail(id, null, 'corr-1')).rejects.toThrow(
      NotFoundException,
    );
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
    await expect(service.detail(id, owner, 'corr-1')).resolves.toMatchObject({
      rejectionReason: 'Not allowed on campus',
    });
    await expect(service.detail(id, other, 'corr-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('shows an UNPUBLISHED listing to its owner only', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(listing({ status: 'UNPUBLISHED' }));
    await expect(service.detail(id, owner, 'corr-1')).resolves.toMatchObject({
      status: 'UNPUBLISHED',
    });
    await expect(service.detail(id, other, 'corr-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('answers 404 for an unknown listing', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.detail(id, owner, 'corr-1')).rejects.toThrow(
      NotFoundException,
    );
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
