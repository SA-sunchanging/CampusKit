import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, onSessionExpired, setToken } from '../auth/token.ts';
import { MemoryStorage } from '../test/memory-storage.ts';
import { api } from './client.ts';

function respond(status: number, body?: unknown) {
  const fetchMock = vi.fn(async () => Response.json(body ?? {}, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the stored token as a Bearer header', async () => {
    setToken('abc');
    const fetchMock = respond(200, { ok: true });
    await expect(api('/identity/accounts/me')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/identity/accounts/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer abc' }),
      }),
    );
  });

  it('throws the server error message', async () => {
    respond(409, { error: { code: 'CONFLICT', message: 'Email taken' } });
    await expect(api('/identity/accounts')).rejects.toThrow('Email taken');
  });

  it('clears the token and reports the expiry on a 401', async () => {
    setToken('abc');
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);
    respond(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } });
    await expect(api('/identity/accounts/me')).rejects.toThrow('Expired');
    unsubscribe();
    expect(getToken()).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  });

  it('does not report an expiry for a 401 without a token', async () => {
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);
    respond(401, {
      error: { code: 'UNAUTHORIZED', message: 'Wrong password' },
    });
    await expect(api('/identity/auth/login')).rejects.toThrow('Wrong password');
    unsubscribe();
    expect(expired).not.toHaveBeenCalled();
  });
});
