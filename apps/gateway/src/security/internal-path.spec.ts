import type { NextFunction, Request, Response } from 'express';
import { isInternalPath, rejectInternalPath } from './internal-path.js';

describe('isInternalPath', () => {
  it.each([
    '/internal/users/a1/eligibility',
    '/Internal/users/a1/eligibility',
    '/INTERNAL/users',
    '/internal',
    '/internal?x=1',
    '/internal%2Fusers%2Fa1%2Feligibility',
    '/%69nternal/users',
    '/%2569nternal/users',
    '//internal/users',
    '/./internal/users',
    '/accounts/../internal/users',
    '/accounts/..%2Finternal/users',
    '/\\internal/users',
  ])('treats %s as internal', (url) => {
    expect(isInternalPath(url)).toBe(true);
  });

  it.each([
    '/accounts/me',
    '/accounts',
    '/health',
    '/listings?q=internal',
    '/internals/x',
    '/my-internal/x',
  ])('lets %s through', (url) => {
    expect(isInternalPath(url)).toBe(false);
  });

  it('throws on malformed percent-encoding', () => {
    expect(() => isInternalPath('/%E0%A4%A')).toThrow(URIError);
  });
});

function run(url: string) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  rejectInternalPath(
    { url } as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  return { res, next };
}

describe('rejectInternalPath', () => {
  it('answers 404 in the shared error shape without forwarding', () => {
    const { res, next } = run('/internal/users/a1/eligibility');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 400 for a path that cannot be decoded', () => {
    const { res, next } = run('/%E0%A4%A');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'Malformed path' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a public path', () => {
    const { res, next } = run('/accounts/me');
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
