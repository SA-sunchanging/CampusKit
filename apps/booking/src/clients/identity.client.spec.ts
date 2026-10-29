import { status } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { IdentityClient } from './identity.client.js';

const userId = '00000000-0000-4000-8000-000000000001';
const call = { correlationId: 'corr-1' };

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

describe('IdentityClient.requireBooker', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts an eligible user and forwards the correlation ID', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { canBook: true, reasons: ['PAYOUT_PROFILE_MISSING'] }),
    );
    await expect(
      new IdentityClient().requireBooker(userId, call),
    ).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:3001/internal/users/${userId}/eligibility`,
    );
    expect(init.headers).toEqual({ 'x-correlation-id': 'corr-1' });
  });

  it('refuses a user who may not book, naming the reasons', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { canBook: false, reasons: ['EMAIL_NOT_VERIFIED'] }),
    );
    expect(
      await errorOf(new IdentityClient().requireBooker(userId, call)),
    ).toEqual({
      code: status.PERMISSION_DENIED,
      message: 'You cannot book yet: EMAIL_NOT_VERIFIED',
    });
  });

  it('refuses an unknown account', async () => {
    fetchMock.mockResolvedValueOnce(reply(404, {}));
    expect(
      (await errorOf(new IdentityClient().requireBooker(userId, call)))?.code,
    ).toBe(status.PERMISSION_DENIED);
  });

  it.each([
    ['an error status', () => Promise.resolve(reply(500, {}))],
    ['an unexpected body', () => Promise.resolve(reply(200, { ok: true }))],
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
  ])('answers UNAVAILABLE for %s', async (_case, answer) => {
    fetchMock.mockImplementationOnce(answer);
    expect(
      (await errorOf(new IdentityClient().requireBooker(userId, call)))?.code,
    ).toBe(status.UNAVAILABLE);
  });

  it('gives up after five seconds', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockRejectedValueOnce(
      new DOMException('The operation timed out', 'TimeoutError'),
    );
    expect(
      (await errorOf(new IdentityClient().requireBooker(userId, call)))?.code,
    ).toBe(status.UNAVAILABLE);
    expect(timeout).toHaveBeenCalledWith(5_000);
    timeout.mockRestore();
  });
});
