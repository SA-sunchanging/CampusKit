import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../test/memory-storage.ts';
import { bookingsQuery, cancelBooking, periodQuery } from './booking.ts';

const id = '33333333-3333-4333-8333-333333333333';

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, method: init?.method, body: JSON.parse(String(init?.body)) };
}

describe('cancelBooking', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the trimmed reason and returns the cancelled booking', async () => {
    const fetchMock = mockFetch(Response.json({ id, status: 'CANCELLED' }));
    await expect(cancelBooking(id, '  Plans changed ')).resolves.toEqual({
      id,
      status: 'CANCELLED',
    });
    expect(requestOf(fetchMock)).toEqual({
      url: `/api/booking/bookings/${id}/cancel`,
      method: 'POST',
      body: { reason: 'Plans changed' },
    });
  });

  it('sends no reason when it is empty', async () => {
    const fetchMock = mockFetch(Response.json({ id, status: 'CANCELLED' }));
    await cancelBooking(id, '   ');
    expect(requestOf(fetchMock).body).toEqual({});
  });

  it('fails with the server message once the item is picked up', async () => {
    mockFetch(
      Response.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'The item was already picked up',
          },
        },
        { status: 409 },
      ),
    );
    await expect(cancelBooking(id)).rejects.toThrow(
      'The item was already picked up',
    );
  });
});

describe('bookingsQuery', () => {
  it('always sends the role', () => {
    expect(bookingsQuery('renter')).toBe('?role=renter');
  });

  it('adds the status when given', () => {
    expect(bookingsQuery('owner', 'PENDING')).toBe(
      '?role=owner&status=PENDING',
    );
  });
});

describe('periodQuery', () => {
  it('encodes both ends', () => {
    expect(
      periodQuery({
        start: '2026-11-01T17:00:00.000Z',
        end: '2026-11-04T17:00:00.000Z',
      }),
    ).toBe(
      '?start=2026-11-01T17%3A00%3A00.000Z&end=2026-11-04T17%3A00%3A00.000Z',
    );
  });
});
