import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  checkServiceToken,
  INTERNAL_AUDIENCE,
  INTERNAL_JWT_SECRET,
  InternalAuthGuard,
  InternalCallers,
  SERVICE_TOKEN_HEADER,
  ServiceTokenSigner,
} from './service-token.js';

const jwt = new JwtService({ secret: INTERNAL_JWT_SECRET });

describe('ServiceTokenSigner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs the service name for the internal audience, valid for five minutes', () => {
    const claims = jwt.verify<{
      sub: string;
      aud: string;
      iat: number;
      exp: number;
    }>(new ServiceTokenSigner('booking').token(), { algorithms: ['HS256'] });
    expect(claims.sub).toBe('booking');
    expect(claims.aud).toBe(INTERNAL_AUDIENCE);
    expect(claims.exp - claims.iat).toBe(300);
  });

  it('reuses the token until one minute before it expires, then signs a new one', () => {
    vi.useFakeTimers({ now: new Date('2026-10-30T00:00:00Z') });
    const signer = new ServiceTokenSigner('rental');
    const first = signer.token();
    vi.setSystemTime(new Date('2026-10-30T00:03:59Z'));
    expect(signer.token()).toBe(first);
    vi.setSystemTime(new Date('2026-10-30T00:04:00Z'));
    const second = signer.token();
    expect(second).not.toBe(first);
    expect(jwt.verify<{ sub: string }>(second).sub).toBe('rental');
  });
});

describe('checkServiceToken', () => {
  const allowed = ['booking'];
  const tokenOf = (
    claims: object,
    options: object,
    secret = INTERNAL_JWT_SECRET,
  ) => new JwtService({ secret }).sign(claims, options);

  it('accepts an allowed service', () => {
    const token = new ServiceTokenSigner('booking').token();
    expect(checkServiceToken(jwt, token, allowed)).toEqual({
      ok: true,
      service: 'booking',
    });
  });

  it.each([
    ['a missing token', undefined],
    ['an empty token', ''],
    ['several header values', ['a', 'b']],
    ['a token that is not a JWT', 'not-a-token'],
    [
      'a token signed with another secret',
      new ServiceTokenSigner('booking', 'other-secret').token(),
    ],
    [
      'a token for another audience',
      tokenOf({ sub: 'booking' }, { audience: 'web', expiresIn: 60 }),
    ],
    [
      'a user token without an audience',
      tokenOf({ sub: 'booking', role: 'student' }, { expiresIn: 60 }),
    ],
    [
      'an expired token',
      tokenOf(
        { sub: 'booking', exp: Math.floor(Date.now() / 1000) - 10 },
        { audience: INTERNAL_AUDIENCE },
      ),
    ],
    [
      'a token without exp',
      tokenOf({ sub: 'booking' }, { audience: INTERNAL_AUDIENCE }),
    ],
    [
      'a token without sub',
      tokenOf({}, { audience: INTERNAL_AUDIENCE, expiresIn: 60 }),
    ],
    [
      'a token signed with another algorithm',
      tokenOf(
        { sub: 'booking' },
        { audience: INTERNAL_AUDIENCE, expiresIn: 60, algorithm: 'HS512' },
      ),
    ],
  ])('refuses %s as unauthenticated', (_case, token) => {
    expect(checkServiceToken(jwt, token, allowed)).toMatchObject({
      ok: false,
      reason: 'unauthenticated',
    });
  });

  it('refuses a valid token from a service not on the list as forbidden', () => {
    const token = new ServiceTokenSigner('review').token();
    expect(checkServiceToken(jwt, token, allowed)).toEqual({
      ok: false,
      reason: 'forbidden',
      message: 'The review service may not call this endpoint',
    });
  });
});

@InternalCallers('booking', 'listing')
class Routes {
  open(): void {}

  @InternalCallers('review')
  narrowed(): void {}
}

class Unlisted {
  open(): void {}
}

function contextFor(
  target: { prototype: object; name: string },
  method: string,
  headers: Record<string, unknown>,
): ExecutionContext {
  const handler = (target.prototype as Record<string, unknown>)[method];
  return {
    getHandler: () => handler,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('InternalCallers', () => {
  it('records the allowed services on the controller and on a route', () => {
    const reflector = new Reflector();
    expect(
      reflector.get<string[]>('campuskit:internal-callers', Routes),
    ).toEqual(['booking', 'listing']);
    expect(
      reflector.get<string[]>(
        'campuskit:internal-callers',
        contextFor(Routes, 'narrowed', {}).getHandler(),
      ),
    ).toEqual(['review']);
  });
});

describe('InternalAuthGuard', () => {
  const guard = new InternalAuthGuard(new Reflector());
  const headerOf = (service: string) => ({
    [SERVICE_TOKEN_HEADER]: new ServiceTokenSigner(service).token(),
  });

  it('lets an allowed service through', () => {
    expect(
      guard.canActivate(contextFor(Routes, 'open', headerOf('listing'))),
    ).toBe(true);
  });

  it('answers 401 without a token', () => {
    expect(() => guard.canActivate(contextFor(Routes, 'open', {}))).toThrow(
      UnauthorizedException,
    );
  });

  it('answers 401 for a forged token', () => {
    const forged = new ServiceTokenSigner('booking', 'other-secret').token();
    expect(() =>
      guard.canActivate(
        contextFor(Routes, 'open', { [SERVICE_TOKEN_HEADER]: forged }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('answers 403 for a service the controller does not allow', () => {
    expect(() =>
      guard.canActivate(contextFor(Routes, 'open', headerOf('payment'))),
    ).toThrow(ForbiddenException);
  });

  it("uses a route's list instead of its controller's", () => {
    expect(
      guard.canActivate(contextFor(Routes, 'narrowed', headerOf('review'))),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(Routes, 'narrowed', headerOf('booking'))),
    ).toThrow(ForbiddenException);
  });

  it('refuses every caller when no list is given', () => {
    expect(() =>
      guard.canActivate(contextFor(Unlisted, 'open', headerOf('booking'))),
    ).toThrow(ForbiddenException);
  });
});
