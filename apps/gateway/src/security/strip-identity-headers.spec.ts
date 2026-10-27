import type { NextFunction, Request, Response } from 'express';
import { stripIdentityHeaders } from './strip-identity-headers.js';

function run(headers: Record<string, string>) {
  const req = { headers: { ...headers } };
  const next = vi.fn();
  stripIdentityHeaders(
    req as unknown as Request,
    {} as Response,
    next as NextFunction,
  );
  return { headers: req.headers, next };
}

describe('stripIdentityHeaders', () => {
  it.each([
    'x-user-id',
    'x-user-role',
    'x-user-email',
    'x-auth-user',
    'x-auth-request-user',
    'x-role',
    'x-roles',
    'x-forwarded-user',
  ])('removes %s', (name) => {
    const { headers, next } = run({ [name]: 'admin' });
    expect(headers).not.toHaveProperty(name);
    expect(next).toHaveBeenCalledOnce();
  });

  it('keeps the headers a request needs', () => {
    const kept = {
      authorization: 'Bearer t',
      'content-type': 'application/json',
      accept: 'application/json',
      'x-correlation-id': 'c1',
      'x-forwarded-for': '10.0.0.1',
      'x-userland': 'y',
      'user-agent': 'curl',
    };
    const { headers } = run({ ...kept, 'x-user-id': 'u2' });
    expect(headers).toEqual(kept);
  });
});
