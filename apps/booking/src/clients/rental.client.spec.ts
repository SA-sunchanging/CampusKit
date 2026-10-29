import { type CreateRentalRequest, RentalClient } from './rental.client.js';

const call = { correlationId: 'corr-1' };
const request: CreateRentalRequest = {
  bookingId: 'b1',
  listingId: 'l1',
  ownerId: 'owner-1',
  renterId: 'renter-1',
  period: {
    start: '2026-11-01T17:00:00.000Z',
    end: '2026-11-04T17:00:00.000Z',
  },
  terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
};

function reply(code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status: code });
}

describe('RentalClient.create', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the rental and returns its ID', async () => {
    fetchMock.mockResolvedValueOnce(reply(201, { id: 'rental-1' }));
    await expect(new RentalClient().create(request, call)).resolves.toEqual({
      ok: true,
      value: { id: 'rental-1' },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3003/internal/rentals');
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it('reports a 4xx as declined', async () => {
    fetchMock.mockResolvedValueOnce(reply(409, {}));
    await expect(
      new RentalClient().create(request, call),
    ).resolves.toMatchObject({ ok: false, reason: 'declined' });
  });

  it.each([404, 501, 502])('reports HTTP %i as unavailable', async (code) => {
    fetchMock.mockResolvedValueOnce(reply(code, {}));
    await expect(
      new RentalClient().create(request, call),
    ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('reports a network failure as unavailable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(
      new RentalClient().create(request, call),
    ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
  });
});
