import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { Listing } from '../listings/listing.entity.js';
import { ModerationService } from './moderation.service.js';

const admin = {
  sub: '00000000-0000-4000-8000-000000000009',
  role: 'admin' as const,
};
const ownerId = '00000000-0000-4000-8000-000000000001';
const id = '11111111-1111-4111-8111-111111111111';
const call = { authorization: 'Bearer t', correlationId: 'corr-1' };
const now = new Date('2026-10-29T05:00:00Z');

const pending = (): Partial<Listing> => ({
  id,
  ownerId,
  ownerName: 'Somchai Jaidee',
  status: 'PENDING_REVIEW',
  title: 'Camera',
  replacementValue: 2_000_000,
  moderationFlags: ['Replacement value is 10,000 THB or more'],
  rejectionReason: null,
  reviewedBy: null,
  reviewedAt: null,
  publishedAt: null,
});

function setup(initial: Partial<Listing> | null = pending()) {
  let stored = initial ? { ...initial } : undefined;
  const repo = {
    findAndCount: vi.fn().mockResolvedValue([[pending()], 3]),
    findOneBy: vi.fn(() => Promise.resolve(stored ? { ...stored } : null)),
    update: vi.fn((where: Partial<Listing>, fields: Partial<Listing>) => {
      const match = stored?.status === where.status;
      if (stored && match) {
        stored = { ...stored, ...fields };
      }
      return Promise.resolve({ affected: match ? 1 : 0 });
    }),
  };
  const tx = {
    getRepository: vi.fn(() => repo),
    query: vi.fn().mockResolvedValue([]),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => unknown) => work(tx)),
  };
  const service = new ModerationService(
    repo as unknown as Repository<Listing>,
    db as unknown as DataSource,
  );
  /** The envelopes written to the outbox, in order. */
  const events = () =>
    tx.query.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse((params as string[])[2]) as unknown);
  return { service, repo, db, events };
}

describe('ModerationService.queue', () => {
  it('returns one page of the status, oldest first', async () => {
    const { service, repo } = setup();
    const result = await service.queue({
      status: 'PENDING_REVIEW',
      page: 2,
      pageSize: 10,
    });
    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: { status: 'PENDING_REVIEW' },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: 10,
      take: 10,
    });
    expect(result).toMatchObject({ total: 3, page: 2, pageSize: 10 });
    expect(result.items[0]).toMatchObject({
      id,
      ownerName: 'Somchai Jaidee',
      replacementValue: 2_000_000,
      moderationFlags: ['Replacement value is 10,000 THB or more'],
    });
  });
});

describe('ModerationService.approve', () => {
  it('publishes the listing and records the reviewer', async () => {
    const { service, repo } = setup();
    const result = await service.approve(admin, id, call, now);
    expect(repo.update).toHaveBeenCalledWith(
      { id, status: 'PENDING_REVIEW' },
      {
        status: 'PUBLISHED',
        publishedAt: now,
        reviewedBy: admin.sub,
        reviewedAt: now,
      },
    );
    expect(result).toMatchObject({ status: 'PUBLISHED', reviewedAt: now });
  });

  it('announces listing.published to the owner in the same transaction', async () => {
    const { service, db, events } = setup();
    await service.approve(admin, id, call, now);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'listing.published',
        recipients: [ownerId],
        correlationId: 'corr-1',
        data: {
          listingId: id,
          ownerId,
          title: 'Camera',
          status: 'PUBLISHED',
        },
      }),
    ]);
  });

  it.each(['PUBLISHED', 'REJECTED', 'DRAFT'] as const)(
    'answers 409 for a %s listing and announces nothing',
    async (status) => {
      const { service, events } = setup({ ...pending(), status });
      await expect(service.approve(admin, id, call, now)).rejects.toThrow(
        ConflictException,
      );
      expect(events()).toEqual([]);
    },
  );

  it('answers 404 for an unknown listing', async () => {
    const { service } = setup(null);
    await expect(service.approve(admin, id, call, now)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ModerationService.reject', () => {
  it('rejects the listing with the reason and records the reviewer', async () => {
    const { service, repo } = setup();
    const result = await service.reject(admin, id, 'Unsafe item', call, now);
    expect(repo.update).toHaveBeenCalledWith(
      { id, status: 'PENDING_REVIEW' },
      {
        status: 'REJECTED',
        rejectionReason: 'Unsafe item',
        reviewedBy: admin.sub,
        reviewedAt: now,
      },
    );
    expect(result).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Unsafe item',
    });
  });

  it('announces listing.rejected with the reason to the owner', async () => {
    const { service, db, events } = setup();
    await service.reject(admin, id, 'Unsafe item', call, now);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'listing.rejected',
        recipients: [ownerId],
        data: expect.objectContaining({
          status: 'REJECTED',
          reason: 'Unsafe item',
        }) as unknown,
      }),
    ]);
  });

  it('lets only the first of two reviews change the listing', async () => {
    const { service, events } = setup();
    await service.approve(admin, id, call, now);
    await expect(
      service.reject(admin, id, 'Too late', call, now),
    ).rejects.toThrow(ConflictException);
    expect(events()).toHaveLength(1);
  });
});
