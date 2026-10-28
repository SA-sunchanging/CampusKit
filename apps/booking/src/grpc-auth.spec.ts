import { Metadata, status } from '@grpc/grpc-js';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { callerFrom } from './grpc-auth.js';

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
