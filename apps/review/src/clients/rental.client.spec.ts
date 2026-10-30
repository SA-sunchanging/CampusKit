import { checkServiceToken, INTERNAL_JWT_SECRET } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { RentalClient, type RentalView } from './rental.client.js';

const RENTAL_ID = '11111111-1111-4111-8111-111111111111';
const rental: RentalView = {
  id: RENTAL_ID,
  listingId: '44444444-4444-4444-8444-444444444444',
  ownerId: '22222222-2222-4222-8222-222222222222',
  renterId: '33333333-3333-4333-8333-333333333333',
  status: 'CLOSED',
};

/** True when the header carries a valid service token signed for Review. */
function signedByReview(token: unknown): boolean {
  const jwt = new JwtService({ secret: INTERNAL_JWT_SECRET });
  return checkServiceToken(jwt, token, ['review']).ok;
}

function reply(code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status: code });
}

describe('RentalClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the rental with the service token and correlation ID', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, rental));
    await expect(new RentalClient().get(RENTAL_ID, 'corr-1')).resolves.toEqual(
      rental,
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://localhost:3003/internal/rentals/${RENTAL_ID}`);
    const headers = init.headers as Record<string, string>;
    expect(headers['x-correlation-id']).toBe('corr-1');
    expect(signedByReview(headers['x-service-token'])).toBe(true);
  });

  it('answers 404 when Rental does not know the rental', async () => {
    fetchMock.mockResolvedValueOnce(reply(404, {}));
    await expect(new RentalClient().get(RENTAL_ID, 'c')).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([
    ['a 5xx', () => Promise.resolve(reply(500, {}))],
    ['an unexpected body', () => Promise.resolve(reply(200, { id: 'x' }))],
    ['a network failure', () => Promise.reject(new Error('ECONNREFUSED'))],
  ])('answers 503 for %s', async (_case, answer) => {
    fetchMock.mockImplementationOnce(answer);
    await expect(new RentalClient().get(RENTAL_ID, 'c')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
