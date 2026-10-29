import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../test/memory-storage.ts';
import {
  confirmEmail,
  registerAndLogin,
  requestEmailCode,
  submitStudentId,
} from './identity.ts';

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
  return {
    url,
    method: init?.method,
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
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

describe('verification calls', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for an email code with an empty POST and returns the demo code', async () => {
    const fetchMock = mockFetch(
      Response.json(
        { expiresAt: '2026-10-29T05:15:00.000Z', demoCode: '042917' },
        { status: 201 },
      ),
    );
    await expect(requestEmailCode()).resolves.toEqual({
      expiresAt: '2026-10-29T05:15:00.000Z',
      demoCode: '042917',
    });
    expect(requestOf(fetchMock, 0)).toEqual({
      url: '/api/identity/accounts/me/email-verification',
      method: 'POST',
      body: undefined,
    });
  });

  it('reports the wait when a code was issued less than a minute ago', async () => {
    mockFetch(
      Response.json(
        {
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Wait 30 seconds before asking for another code',
          },
        },
        { status: 429 },
      ),
    );
    await expect(requestEmailCode()).rejects.toThrow('Wait 30 seconds');
  });

  it('confirms the code and returns the verified profile', async () => {
    const fetchMock = mockFetch(Response.json({ emailVerified: true }));
    await expect(confirmEmail('042917')).resolves.toEqual({
      emailVerified: true,
    });
    expect(requestOf(fetchMock, 0)).toEqual({
      url: '/api/identity/accounts/me/email-verification/confirm',
      method: 'POST',
      body: { code: '042917' },
    });
  });

  it('submits the student ID for review', async () => {
    const fetchMock = mockFetch(Response.json({ studentStatus: 'PENDING' }));
    await expect(submitStudentId('6630012321')).resolves.toEqual({
      studentStatus: 'PENDING',
    });
    expect(requestOf(fetchMock, 0)).toEqual({
      url: '/api/identity/accounts/me/student-status',
      method: 'POST',
      body: { studentId: '6630012321' },
    });
  });
});
