import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../test/memory-storage.ts';
import { registerAndLogin } from './identity.ts';

const registration = {
  email: 'somchai@student.chula.ac.th',
  password: 'correct horse',
  displayName: 'Somchai',
};

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof mockFetch>, call: number) {
  const [url, init] = fetchMock.mock.calls[call];
  return { url, method: init?.method, body: JSON.parse(String(init?.body)) };
}

describe('registerAndLogin', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers, then logs in with the same credentials', async () => {
    const fetchMock = mockFetch(
      Response.json({ id: 'u1' }, { status: 201 }),
      Response.json({ accessToken: 'jwt', expiresIn: 3600 }),
    );
    await expect(registerAndLogin(registration)).resolves.toEqual({
      accessToken: 'jwt',
      expiresIn: 3600,
    });
    expect(requestOf(fetchMock, 0)).toEqual({
      url: '/api/identity/accounts',
      method: 'POST',
      body: registration,
    });
    expect(requestOf(fetchMock, 1)).toEqual({
      url: '/api/identity/auth/login',
      method: 'POST',
      body: { email: registration.email, password: registration.password },
    });
  });

  it('stops with the server message when registration fails', async () => {
    const fetchMock = mockFetch(
      Response.json(
        { error: { code: 'CONFLICT', message: 'Email is already registered' } },
        { status: 409 },
      ),
    );
    await expect(registerAndLogin(registration)).rejects.toThrow(
      'Email is already registered',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports the server message when the login step fails', async () => {
    mockFetch(
      Response.json({ id: 'u1' }, { status: 201 }),
      Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
        { status: 401 },
      ),
    );
    await expect(registerAndLogin(registration)).rejects.toThrow(
      'Invalid credentials',
    );
  });
});
