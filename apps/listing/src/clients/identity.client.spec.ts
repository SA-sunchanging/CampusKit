import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IdentityClient } from './identity.client.js';

const userId = '00000000-0000-4000-8000-000000000001';

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('IdentityClient.requirePublisher', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the display name of an eligible user and forwards the correlation ID', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, { canPublish: true, reasons: [] }))
      .mockResolvedValueOnce(reply(200, { displayName: 'Somchai Jaidee' }));
    await expect(
      new IdentityClient().requirePublisher(userId, 'corr-1'),
    ).resolves.toBe('Somchai Jaidee');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/internal/users/${userId}/eligibility`);
    expect(init.headers).toEqual({ 'x-correlation-id': 'corr-1' });
  });

  it('refuses a user who may not publish, naming the reasons', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { canPublish: false, reasons: ['PAYOUT_PROFILE_MISSING'] }),
    );
    const call = new IdentityClient().requirePublisher(userId, 'corr-1');
    await expect(call).rejects.toThrow(ForbiddenException);
    await expect(call).rejects.toThrow('PAYOUT_PROFILE_MISSING');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers 503 when Identity cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(
      new IdentityClient().requirePublisher(userId, 'corr-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('answers 503 when Identity fails', async () => {
    fetchMock.mockResolvedValueOnce(reply(500, {}));
    await expect(
      new IdentityClient().requirePublisher(userId, 'corr-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('answers 403 for an unknown account', async () => {
    fetchMock.mockResolvedValueOnce(reply(404, {}));
    await expect(
      new IdentityClient().requirePublisher(userId, 'corr-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
