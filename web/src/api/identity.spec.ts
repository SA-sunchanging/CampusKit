import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../test/memory-storage.ts';
import {
  approveStudent,
  confirmEmail,
  getMe,
  getStudentQueue,
  registerAndLogin,
  rejectStudent,
  requestEmailCode,
  setPayoutProfile,
  studentQueueQuery,
  submitStudentId,
  type PayoutProfile,
  type Profile,
} from './identity.ts';
import { TOKEN_KEY } from '../auth/token.ts';

const studentId = '11111111-1111-4111-8111-111111111111';

const registration = {
  email: 'somchai@student.chula.ac.th',
  password: 'correct horse',
  displayName: 'Somchai',
};

const payoutProfile: PayoutProfile = {
  method: 'PROMPTPAY',
  promptPayId: '0812345678',
  accountName: 'Somchai',
};

const profile: Profile = {
  id: studentId,
  email: registration.email,
  displayName: registration.displayName,
  role: 'student',
  emailVerified: true,
  studentStatus: 'VERIFIED',
  studentId: '6630012321',
  studentRejectionReason: null,
  payoutProfile: null,
  createdAt: '2026-10-29T05:00:00.000Z',
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
    const verified = { ...profile, payoutProfile };
    const fetchMock = mockFetch(Response.json(verified));
    await expect(confirmEmail('042917')).resolves.toEqual(verified);
    expect(requestOf(fetchMock, 0)).toEqual({
      url: '/api/identity/accounts/me/email-verification/confirm',
      method: 'POST',
      body: { code: '042917' },
    });
  });

  it('submits the student ID for review', async () => {
    const pending = { ...profile, studentStatus: 'PENDING', payoutProfile };
    const fetchMock = mockFetch(Response.json(pending));
    await expect(submitStudentId('6630012321')).resolves.toEqual(pending);
    expect(requestOf(fetchMock, 0)).toEqual({
      url: '/api/identity/accounts/me/student-status',
      method: 'POST',
      body: { studentId: '6630012321' },
    });
  });
});

describe('payout profile calls', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    localStorage.setItem(TOKEN_KEY, 'student-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([null, payoutProfile])(
    'loads the saved payout profile %j',
    async (saved) => {
      const ownProfile = { ...profile, payoutProfile: saved };
      const fetchMock = mockFetch(Response.json(ownProfile));
      await expect(getMe()).resolves.toEqual(ownProfile);
      expect(fetchMock.mock.calls[0][0]).toBe('/api/identity/accounts/me');
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer student-token',
      });
    },
  );

  it('saves a payout profile with an authenticated PUT and returns the saved values', async () => {
    const saved = { ...payoutProfile, accountName: 'Somchai Chula' };
    const fetchMock = mockFetch(Response.json(saved));
    await expect(setPayoutProfile(saved)).resolves.toEqual(saved);
    expect(requestOf(fetchMock, 0)).toEqual({
      url: '/api/identity/accounts/me/payout-profile',
      method: 'PUT',
      body: saved,
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer student-token',
      'Content-Type': 'application/json',
    });
  });

  it('propagates a rejected payout update for the form to display', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid PromptPay ID' } },
        { status: 400 },
      ),
    );
    await expect(setPayoutProfile(payoutProfile)).rejects.toThrow(
      'Invalid PromptPay ID',
    );
  });
});

describe('studentQueueQuery', () => {
  it('always sends the status and leaves out page 1', () => {
    expect(studentQueueQuery('PENDING')).toBe('?status=PENDING');
  });

  it('keeps pages after the first', () => {
    expect(studentQueueQuery('REJECTED', 2)).toBe('?status=REJECTED&page=2');
  });
});

describe('student review calls', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for the students waiting for review by default', async () => {
    const fetchMock = mockFetch(
      Response.json({ items: [], total: 0, page: 1, pageSize: 20 }),
    );
    await getStudentQueue();
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/identity/admin/students?status=PENDING',
    );
  });

  it('approves with an empty POST', async () => {
    const fetchMock = mockFetch(
      Response.json({ id: studentId, studentStatus: 'VERIFIED' }),
    );
    await expect(approveStudent(studentId)).resolves.toMatchObject({
      studentStatus: 'VERIFIED',
    });
    expect(requestOf(fetchMock, 0)).toEqual({
      url: `/api/identity/admin/students/${studentId}/approve`,
      method: 'POST',
      body: undefined,
    });
  });

  it('rejects with the reason', async () => {
    const fetchMock = mockFetch(
      Response.json({ id: studentId, studentStatus: 'REJECTED' }),
    );
    await rejectStudent(studentId, 'Not enrolled this term');
    expect(requestOf(fetchMock, 0)).toEqual({
      url: `/api/identity/admin/students/${studentId}/reject`,
      method: 'POST',
      body: { reason: 'Not enrolled this term' },
    });
  });
});
