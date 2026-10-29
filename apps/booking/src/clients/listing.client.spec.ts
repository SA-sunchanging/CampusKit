import { status } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { ListingClient } from './listing.client.js';

const listingId = '11111111-1111-4111-8111-111111111111';
const call = { correlationId: 'corr-1' };
const period = {
  start: new Date('2026-11-01T17:00:00Z'),
  end: new Date('2026-11-04T17:00:00Z'),
};
const quote = {
  listingId,
  ownerId: '00000000-0000-4000-8000-000000000001',
  days: 3,
  rentalFee: 6000,
  deposit: 30000,
  lateFeePerDay: 4000,
};

function reply(code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status: code });
}

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return (err as RpcException).getError() as {
      code: number;
      message: string;
    };
  }
  return undefined;
}

describe('ListingClient.quote', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the quote for the period and forwards the correlation ID', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, quote));
    await expect(
      new ListingClient().quote(listingId, period, call),
    ).resolves.toEqual(quote);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe(`/internal/listings/${listingId}/quote`);
    expect(parsed.searchParams.get('start')).toBe('2026-11-01T17:00:00.000Z');
    expect(parsed.searchParams.get('end')).toBe('2026-11-04T17:00:00.000Z');
    expect(init.headers).toEqual({ 'x-correlation-id': 'corr-1' });
  });

  it.each([
    [400, status.INVALID_ARGUMENT],
    [404, status.NOT_FOUND],
    [409, status.FAILED_PRECONDITION],
    [500, status.UNAVAILABLE],
    [503, status.UNAVAILABLE],
  ])('maps HTTP %i to gRPC code %i', async (code, expected) => {
    fetchMock.mockResolvedValueOnce(
      reply(code, { error: { code: 'X', message: 'why' } }),
    );
    expect(
      (await errorOf(new ListingClient().quote(listingId, period, call)))?.code,
    ).toBe(expected);
  });

  it("passes on Listing's reason for refusing the period", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(400, {
        error: {
          code: 'BAD_REQUEST',
          message: 'This item can be rented for at most 7 days',
        },
      }),
    );
    expect(
      (await errorOf(new ListingClient().quote(listingId, period, call)))
        ?.message,
    ).toBe('This item can be rented for at most 7 days');
  });

  it('answers UNAVAILABLE for a reply without a valid quote', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { ...quote, deposit: '300' }));
    expect(
      (await errorOf(new ListingClient().quote(listingId, period, call)))?.code,
    ).toBe(status.UNAVAILABLE);
  });

  it('answers UNAVAILABLE when Listing cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(
      (await errorOf(new ListingClient().quote(listingId, period, call)))?.code,
    ).toBe(status.UNAVAILABLE);
  });
});
