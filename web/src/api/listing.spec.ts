import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../test/memory-storage.ts';
import {
  approveListing,
  getReviewQueue,
  rejectListing,
  reviewQueueQuery,
  searchListings,
  searchQuery,
  unpublishListing,
} from './listing.ts';

const id = '11111111-1111-4111-8111-111111111111';

function mockFetch(body: unknown) {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(Response.json(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0];
  return {
    url,
    method: init?.method,
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

describe('searchQuery', () => {
  it('is empty when no filter is set', () => {
    expect(searchQuery({})).toBe('');
  });

  it('leaves out blank keywords and the default page', () => {
    expect(searchQuery({ q: '   ', page: 1 })).toBe('');
  });

  it('trims the keyword and keeps the category', () => {
    expect(searchQuery({ q: '  calculus ', category: 'BOOKS' })).toBe(
      '?q=calculus&category=BOOKS',
    );
  });

  it('keeps pages after the first', () => {
    expect(searchQuery({ category: 'SPORTS', page: 3 })).toBe(
      '?category=SPORTS&page=3',
    );
  });

  it('includes the page size only when given', () => {
    expect(searchQuery({ pageSize: 20 })).toBe('?pageSize=20');
  });

  it('adds the pickup point and both ends of the period', () => {
    expect(
      searchQuery({
        location: 'ENGINEERING',
        period: {
          start: '2026-11-01T17:00:00.000Z',
          end: '2026-11-03T17:00:00.000Z',
        },
      }),
    ).toBe(
      '?location=ENGINEERING&start=2026-11-01T17%3A00%3A00.000Z&end=2026-11-03T17%3A00%3A00.000Z',
    );
  });

  it('encodes special characters in the keyword', () => {
    expect(searchQuery({ q: 'gown & cap' })).toBe('?q=gown+%26+cap');
  });
});

describe('reviewQueueQuery', () => {
  it('always sends the status and leaves out page 1', () => {
    expect(reviewQueueQuery('PENDING_REVIEW')).toBe('?status=PENDING_REVIEW');
  });

  it('keeps pages after the first', () => {
    expect(reviewQueueQuery('REJECTED', 2)).toBe('?status=REJECTED&page=2');
  });
});

describe('searchListings', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the filters and returns the owner ratings', async () => {
    const fetchMock = mockFetch({
      items: [{ id, ownerRating: 4.5, ownerReviewCount: 12 }],
      total: 1,
      page: 1,
      pageSize: 12,
    });
    const page = await searchListings({
      location: 'ARTS',
      period: {
        start: '2026-11-01T17:00:00.000Z',
        end: '2026-11-02T17:00:00.000Z',
      },
    });
    expect(page.items[0]).toMatchObject({
      ownerRating: 4.5,
      ownerReviewCount: 12,
    });
    expect(requestOf(fetchMock).url).toBe(
      '/api/listing/listings?location=ARTS&start=2026-11-01T17%3A00%3A00.000Z&end=2026-11-02T17%3A00%3A00.000Z',
    );
  });
});

describe('owner and moderation calls', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for the listings waiting for review by default', async () => {
    const fetchMock = mockFetch({ items: [], total: 0, page: 1, pageSize: 20 });
    await getReviewQueue();
    expect(requestOf(fetchMock)).toEqual({
      url: '/api/listing/admin/listings?status=PENDING_REVIEW',
      method: undefined,
      body: undefined,
    });
  });

  it('approves with an empty POST', async () => {
    const fetchMock = mockFetch({ id, status: 'PUBLISHED' });
    await expect(approveListing(id)).resolves.toMatchObject({
      status: 'PUBLISHED',
    });
    expect(requestOf(fetchMock)).toEqual({
      url: `/api/listing/admin/listings/${id}/approve`,
      method: 'POST',
      body: undefined,
    });
  });

  it('unpublishes with an empty POST', async () => {
    const fetchMock = mockFetch({ id, status: 'UNPUBLISHED' });
    await expect(unpublishListing(id)).resolves.toMatchObject({
      status: 'UNPUBLISHED',
    });
    expect(requestOf(fetchMock)).toEqual({
      url: `/api/listing/listings/${id}/unpublish`,
      method: 'POST',
      body: undefined,
    });
  });

  it('rejects with the reason in the body', async () => {
    const fetchMock = mockFetch({ id, status: 'REJECTED' });
    await rejectListing(id, 'Not allowed on campus');
    expect(requestOf(fetchMock)).toEqual({
      url: `/api/listing/admin/listings/${id}/reject`,
      method: 'POST',
      body: { reason: 'Not allowed on campus' },
    });
  });
});
