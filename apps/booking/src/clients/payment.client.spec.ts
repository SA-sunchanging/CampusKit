import { type AuthorizeRequest, PaymentClient } from './payment.client.js';

const call = { correlationId: 'corr-1' };
const request: AuthorizeRequest = {
  operationId: 'booking:b1:authorize-fee',
  bookingId: 'b1',
  payerId: 'renter-1',
  payeeId: 'owner-1',
  kind: 'FEE',
  amount: 6000,
};

function reply(code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status: code });
}

describe('PaymentClient.authorize', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the authorization with the correlation ID', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(201, { id: 'auth-1', status: 'AUTHORIZED' }),
    );
    await expect(new PaymentClient().authorize(request, call)).resolves.toEqual(
      { ok: true, value: { id: 'auth-1', status: 'AUTHORIZED' } },
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3004/internal/payments/authorize');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'x-correlation-id': 'corr-1',
      'content-type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it('reports a decline with the Payment message', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(422, { error: { code: 'X', message: 'No payment method' } }),
    );
    await expect(new PaymentClient().authorize(request, call)).resolves.toEqual(
      { ok: false, reason: 'declined', message: 'No payment method' },
    );
  });

  it.each([404, 500, 501, 503])(
    'reports HTTP %i as unavailable',
    async (code) => {
      fetchMock.mockResolvedValueOnce(reply(code, {}));
      await expect(
        new PaymentClient().authorize(request, call),
      ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
    },
  );

  it('reports a timeout as unavailable', async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException('The operation timed out', 'TimeoutError'),
    );
    await expect(new PaymentClient().authorize(request, call)).resolves.toEqual(
      {
        ok: false,
        reason: 'unavailable',
        message: 'The payment service is unavailable',
      },
    );
  });

  it('reports a success without an authorization ID as unavailable', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { status: 'AUTHORIZED' }));
    await expect(
      new PaymentClient().authorize(request, call),
    ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
  });
});
