import type { EntityManager } from 'typeorm';
import {
  announcePublished,
  announceRejected,
  listingEventData,
} from './listing-events.js';
import type { Listing } from './listing.entity.js';

const listing = {
  id: 'l1',
  ownerId: 'o1',
  title: 'Calculus I textbook',
  status: 'PUBLISHED',
  dailyRate: 2000,
} as Listing;

describe('listingEventData', () => {
  it('carries the IDs, the title and the new status only', () => {
    expect(listingEventData(listing)).toEqual({
      listingId: 'l1',
      ownerId: 'o1',
      title: 'Calculus I textbook',
      status: 'PUBLISHED',
    });
  });
});

describe('announcePublished', () => {
  it('writes listing.published for the owner, produced by listing', async () => {
    const query = vi.fn().mockResolvedValue([]);
    await announcePublished(
      { query } as unknown as EntityManager,
      listing,
      'corr-1',
    );
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO outbox_events');
    expect(params[1]).toBe('listing.published');
    expect(JSON.parse(params[2] as string)).toMatchObject({
      type: 'listing.published',
      producer: 'listing',
      recipients: ['o1'],
      correlationId: 'corr-1',
      data: listingEventData(listing),
    });
  });
});

describe('announceRejected', () => {
  it('writes listing.rejected with the reason for the owner', async () => {
    const query = vi.fn().mockResolvedValue([]);
    await announceRejected(
      { query } as unknown as EntityManager,
      {
        id: 'l1',
        ownerId: 'o1',
        title: 'Calculus I textbook',
        status: 'REJECTED',
        rejectionReason: 'Not allowed',
      } as Listing,
      'corr-2',
    );
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe('listing.rejected');
    expect(JSON.parse(params[2] as string)).toMatchObject({
      type: 'listing.rejected',
      recipients: ['o1'],
      correlationId: 'corr-2',
      data: {
        listingId: 'l1',
        ownerId: 'o1',
        title: 'Calculus I textbook',
        status: 'REJECTED',
        reason: 'Not allowed',
      },
    });
  });
});
