import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type AuthUser,
  bearerToken,
  JwtAuthGuard,
  verifyAccessToken,
} from './auth.js';

const jwt = new JwtService({ secret: 'test-secret' });
const userId = '00000000-0000-4000-8000-000000000001';
const student = { sub: userId, role: 'student' };
const sign = (claims: object, service = jwt) =>
  service.sign(claims, { expiresIn: 60 });
const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

describe('bearerToken', () => {
  it('returns the token of a bearer header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it.each(['bearer abc.def.ghi', 'BEARER  abc.def.ghi '])(
    'accepts the scheme in any case: %j',
    (header) => {
      expect(bearerToken(header)).toBe('abc.def.ghi');
    },
  );

  it.each([undefined, '', 'Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'abc'])(
    'returns undefined for %j',
    (header) => {
      expect(bearerToken(header)).toBeUndefined();
    },
  );
});

describe('verifyAccessToken', () => {
  it('returns only sub and role of a valid token', () => {
    const token = sign({ ...student, extra: 'x' });
    expect(verifyAccessToken(jwt, token)).toEqual(student);
  });

  it('accepts an admin token', () => {
    const token = sign({ sub: userId, role: 'admin' });
    expect(verifyAccessToken(jwt, token).role).toBe('admin');
  });

  it('rejects a token signed with another secret', () => {
    const token = sign(student, new JwtService({ secret: 'other' }));
    expect(() => verifyAccessToken(jwt, token)).toThrow();
  });

  it('rejects an expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const token = jwt.sign({ ...student, exp });
    expect(() => verifyAccessToken(jwt, token)).toThrow();
  });

  it('rejects an unsigned token with alg none', () => {
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode(student)}.`;
    expect(() => verifyAccessToken(jwt, token)).toThrow();
  });

  it('rejects a token signed with another algorithm', () => {
    const token = jwt.sign(student, { algorithm: 'HS512', expiresIn: 60 });
    expect(() => verifyAccessToken(jwt, token)).toThrow();
  });

  it('rejects a token that is not a JWT', () => {
    expect(() => verifyAccessToken(jwt, 'not-a-token')).toThrow();
  });

  it('rejects a token without exp, which would never expire', () => {
    const token = jwt.sign(student);
    expect(() => verifyAccessToken(jwt, token)).toThrow();
  });

  it.each([
    { role: 'student' },
    { sub: '', role: 'student' },
    { sub: 42, role: 'student' },
    { sub: 'dev-user', role: 'student' },
    { sub: userId },
    { sub: userId, role: 'owner' },
  ])('rejects claims %j', (claims) => {
    const token = sign(claims);
    expect(() => verifyAccessToken(jwt, token)).toThrow();
  });
});

function contextWith(authorization?: string) {
  const req: { headers: { authorization?: string }; user?: AuthUser } = {
    headers: { authorization },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { req, context };
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(jwt);

  it('puts the claims of a valid token on request.user', () => {
    const { req, context } = contextWith(`Bearer ${sign(student)}`);
    expect(guard.canActivate(context)).toBe(true);
    expect(req.user).toEqual(student);
  });

  it.each([undefined, 'Bearer ', 'Basic dXNlcjpwYXNz'])(
    'rejects %j as a missing token',
    (header) => {
      const { context } = contextWith(header);
      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Missing bearer token'),
      );
    },
  );

  it('rejects a bad token as invalid', () => {
    const forged = sign(student, new JwtService({ secret: 'other' }));
    const { context } = contextWith(`Bearer ${forged}`);
    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Invalid token'),
    );
  });
});
