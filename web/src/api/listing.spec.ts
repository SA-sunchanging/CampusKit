import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../test/memory-storage.ts';
import {
  approveListing,
  getReviewQueue,
  rejectListing,
  reviewQueueQuery,
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
