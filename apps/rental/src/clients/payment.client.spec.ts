import { checkServiceToken, INTERNAL_JWT_SECRET } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import {
  type CaptureRequest,
  PaymentClient,
  type SettleRequest,
} from './payment.client.js';

const call = { authorization: 'Bearer token', correlationId: 'corr-1' };

/** True when the value is a valid service token signed for Rental. */
function signedByRental(token: unknown): boolean {
  const jwt = new JwtService({ secret: INTERNAL_JWT_SECRET });
  return checkServiceToken(jwt, token, ['rental']).ok;
}
const capture: CaptureRequest = {
  operationId: 'rental:r1:capture-fee',
  bookingId: 'b1',
  amount: 6000,
};
const settle: SettleRequest = {
  operationId: 'rental:r1:settle',
  bookingId: 'b1',
  deposit: 30000,
  lateFee: 8000,
};
const captured = {
  bookingId: 'b1',
  kind: 'FEE',
  capturedAmount: 6000,
  status: 'CAPTURED',
};
const settled = {
  bookingId: 'b1',
  lateFeeCharged: 8000,
  depositReleased: 22000,
  payout: 14000,
};

function reply(code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status: code });
}

describe('PaymentClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('capture', () => {
    it('posts the capture with the correlation ID and the service token only', async () => {
      fetchMock.mockResolvedValueOnce(reply(200, captured));
      await expect(new PaymentClient().capture(capture, call)).resolves.toEqual(
        { ok: true, value: captured },
      );
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3004/internal/payments/capture');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers).toEqual({
        'x-correlation-id': 'corr-1',
        'x-service-token': expect.any(String),
        'content-type': 'application/json',
      });
      expect(signedByRental(headers['x-service-token'])).toBe(true);
      expect(JSON.parse(init.body as string)).toEqual(capture);
    });

    it('reports a 409 as declined with the Payment message', async () => {
      fetchMock.mockResolvedValueOnce(
        reply(409, {
          error: { code: 'CONFLICT', message: 'The fee has expired' },
        }),
      );
      await expect(new PaymentClient().capture(capture, call)).resolves.toEqual(
        { ok: false, reason: 'declined', message: 'The fee has expired' },
      );
    });

    it.each([404, 500, 501, 503])(
      'reports HTTP %i as unavailable',
      async (code) => {
        fetchMock.mockResolvedValueOnce(reply(code, {}));
        await expect(
          new PaymentClient().capture(capture, call),
        ).resolves.toEqual({
          ok: false,
          reason: 'unavailable',
          message: 'The payment service is unavailable',
        });
      },
    );

    it('reports a timeout as unavailable', async () => {
      fetchMock.mockRejectedValueOnce(
        new DOMException('The operation timed out', 'TimeoutError'),
      );
      await expect(
        new PaymentClient().capture(capture, call),
      ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
    });

    it('reports a success with another body as unavailable', async () => {
      fetchMock.mockResolvedValueOnce(reply(200, { status: 'CAPTURED' }));
      await expect(
        new PaymentClient().capture(capture, call),
      ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
    });
  });

  describe('settle', () => {
    it('posts the settlement', async () => {
      fetchMock.mockResolvedValueOnce(reply(200, settled));
      await expect(new PaymentClient().settle(settle, call)).resolves.toEqual({
        ok: true,
        value: settled,
      });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3004/internal/payments/settle');
      expect(JSON.parse(init.body as string)).toEqual(settle);
    });

    it('reports a 400 as declined with a fallback message', async () => {
      fetchMock.mockResolvedValueOnce(reply(400, {}));
      await expect(new PaymentClient().settle(settle, call)).resolves.toEqual({
        ok: false,
        reason: 'declined',
        message: 'The payment service refused the request (HTTP 400)',
      });
    });

    it('reports a network failure as unavailable', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(
        new PaymentClient().settle(settle, call),
      ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
    });

    it('reports a success without the amounts as unavailable', async () => {
      fetchMock.mockResolvedValueOnce(reply(200, { bookingId: 'b1' }));
      await expect(
        new PaymentClient().settle(settle, call),
      ).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
    });
  });
});
