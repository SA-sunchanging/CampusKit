import { checkServiceToken, INTERNAL_JWT_SECRET } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import { ReviewClient } from './review.client.js';

const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';

/** True when the header carries a valid service token signed for Listing. */
function signedByListing(token: unknown): boolean {
  const jwt = new JwtService({ secret: INTERNAL_JWT_SECRET });
  return checkServiceToken(jwt, token, ['listing']).ok;
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('ReviewClient.reputations', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks once for each distinct user and forwards the correlation ID', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, {
        items: [
          { userId: alice, averageRating: 4.5, reviewCount: 12 },
          { userId: bob, averageRating: null, reviewCount: 0 },
        ],
      }),
    );
    const result = await new ReviewClient().reputations(
      [alice, bob, alice],
      'corr-1',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/internal/reputation?userIds=${alice},${bob}`);
    const headers = init.headers as Record<string, string>;
    expect(headers['x-correlation-id']).toBe('corr-1');
    expect(signedByListing(headers['x-service-token'])).toBe(true);
    expect(result.get(alice)).toEqual({
      ownerRating: 4.5,
      ownerReviewCount: 12,
    });
    expect(result.get(bob)).toEqual({ ownerRating: null, ownerReviewCount: 0 });
  });

  it('makes no call without users', async () => {
    await expect(new ReviewClient().reputations([], 'corr-1')).resolves.toEqual(
      new Map(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns nothing when Review fails or cannot be reached', async () => {
    fetchMock.mockResolvedValueOnce(reply(500, {}));
    await expect(
      new ReviewClient().reputations([alice], 'corr-1'),
    ).resolves.toEqual(new Map());
    fetchMock.mockRejectedValueOnce(new DOMException('timed out'));
    await expect(
      new ReviewClient().reputations([alice], 'corr-1'),
    ).resolves.toEqual(new Map());
  });
});
