import { JWT_SECRET } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { requireToken } from './require-token.js';

const jwt = new JwtService({ secret: JWT_SECRET });
const userId = '00000000-0000-4000-8000-000000000001';
const valid = jwt.sign({ sub: userId, role: 'student' }, { expiresIn: 60 });
const forged = new JwtService({ secret: 'not-the-secret' }).sign({
  sub: userId,
  role: 'admin',
});

function run(method: string, path: string, authorization?: string) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  // Mounted at /api, so Express splits the path into baseUrl and path.
  const req = {
    method,
    baseUrl: '/api',
    path: path.replace(/^\/api/, ''),
    headers: { authorization },
  };
  requireToken(
    req as unknown as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  return { res, next };
}

function expect401(result: ReturnType<typeof run>, message: string) {
  expect(result.res.status).toHaveBeenCalledWith(401);
  expect(result.res.json).toHaveBeenCalledWith({
    error: { code: 'UNAUTHORIZED', message },
  });
  expect(result.next).not.toHaveBeenCalled();
}

describe('requireToken', () => {
  it('forwards a protected request with a valid token', () => {
    const { res, next } = run(
      'GET',
      '/api/identity/accounts/me',
      `Bearer ${valid}`,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'Bearer', 'Bearer ', 'Basic dXNlcjpwYXNz', valid])(
    'answers 401 Missing bearer token for header %j',
    (header) => {
      expect401(
        run('GET', '/api/identity/accounts/me', header),
        'Missing bearer token',
      );
    },
  );

  it.each([
    ['a token signed with another secret', forged],
    ['a token that is not a JWT', 'garbage'],
    ['a tampered token', `${valid.slice(0, -2)}xx`],
  ])('answers 401 Invalid token for %s', (_name, token) => {
    expect401(
      run('GET', '/api/identity/accounts/me', `Bearer ${token}`),
      'Invalid token',
    );
  });

  it('answers 401 Invalid token for an expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const expired = jwt.sign({ sub: userId, role: 'student', exp });
    expect401(
      run('GET', '/api/identity/accounts/me', `Bearer ${expired}`),
      'Invalid token',
    );
  });

  it('protects gateway-owned booking routes too', () => {
    expect401(run('GET', '/api/booking/bookings/b1'), 'Missing bearer token');
  });

  it.each([
    ['POST', '/api/identity/accounts'],
    ['POST', '/api/identity/auth/login'],
    ['GET', '/api/listing/health'],
  ])('lets %s %s through without a token', (method, path) => {
    expect(run(method, path).next).toHaveBeenCalledOnce();
  });

  it('ignores a stale token on a public route', () => {
    const { res, next } = run(
      'POST',
      '/api/identity/auth/login',
      `Bearer ${forged}`,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
