import { toGrpcMetadata } from './grpc-metadata.js';

describe('toGrpcMetadata', () => {
  it('forwards the token and the correlation ID', () => {
    const metadata = toGrpcMetadata({
      authorization: 'Bearer token',
      'x-correlation-id': 'corr-1',
      'x-other': 'ignored',
    });
    expect(metadata.get('authorization')).toEqual(['Bearer token']);
    expect(metadata.get('x-correlation-id')).toEqual(['corr-1']);
    expect(metadata.get('x-other')).toEqual([]);
  });

  it('leaves out headers the request does not carry', () => {
    const metadata = toGrpcMetadata({});
    expect(metadata.get('authorization')).toEqual([]);
    expect(metadata.get('x-correlation-id')).toEqual([]);
  });
});
