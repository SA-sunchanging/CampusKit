import { INTERNAL_JWT_SECRET, ServiceTokenSigner } from '@app/common';
import { Metadata, status } from '@grpc/grpc-js';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { callerFrom, requireService } from './grpc-auth.js';

const jwt = new JwtService({ secret: 'test-secret' });
const userId = '00000000-0000-4000-8000-000000000001';

function metadataWith(authorization?: string): Metadata {
  const metadata = new Metadata();
  if (authorization !== undefined) {
    metadata.set('authorization', authorization);
  }
  return metadata;
}

function codeOf(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (err) {
    return ((err as RpcException).getError() as { code: number }).code;
  }
  return undefined;
}

describe('callerFrom', () => {
  it('returns the claims of a valid token', () => {
    const token = jwt.sign({ sub: userId, role: 'student' }, { expiresIn: 60 });
    expect(callerFrom(metadataWith(`Bearer ${token}`), jwt)).toEqual({
      sub: userId,
      role: 'student',
    });
  });

  it('rejects a call without a token', () => {
    expect(codeOf(() => callerFrom(metadataWith(), jwt))).toBe(
      status.UNAUTHENTICATED,
    );
  });

  it('rejects a token signed with another secret', () => {
    const forged = new JwtService({ secret: 'other' }).sign(
      { sub: userId, role: 'student' },
      { expiresIn: 60 },
    );
    expect(
      codeOf(() => callerFrom(metadataWith(`Bearer ${forged}`), jwt)),
    ).toBe(status.UNAUTHENTICATED);
  });
});

describe('requireService', () => {
  function withServiceToken(token?: string): Metadata {
    const metadata = new Metadata();
    if (token !== undefined) {
      metadata.set('x-service-token', token);
    }
    return metadata;
  }

  it('accepts a token from an allowed service', () => {
    const token = new ServiceTokenSigner('listing').token();
    expect(
      codeOf(() => requireService(withServiceToken(token), ['listing'])),
    ).toBeUndefined();
  });

  it('rejects a call without a service token', () => {
    expect(codeOf(() => requireService(withServiceToken(), ['listing']))).toBe(
      status.UNAUTHENTICATED,
    );
  });

  it('rejects a service token signed with another secret', () => {
    const forged = new ServiceTokenSigner('listing', 'other').token();
    expect(
      codeOf(() => requireService(withServiceToken(forged), ['listing'])),
    ).toBe(status.UNAUTHENTICATED);
  });

  it('rejects a token without the internal audience, even with the internal secret', () => {
    const user = new JwtService({ secret: INTERNAL_JWT_SECRET }).sign(
      { sub: 'listing', role: 'student' },
      { expiresIn: 60 },
    );
    expect(
      codeOf(() => requireService(withServiceToken(user), ['listing'])),
    ).toBe(status.UNAUTHENTICATED);
  });

  it('refuses a service that the method does not allow', () => {
    const token = new ServiceTokenSigner('review').token();
    expect(
      codeOf(() => requireService(withServiceToken(token), ['rental'])),
    ).toBe(status.PERMISSION_DENIED);
  });
});
