import { Metadata } from '@grpc/grpc-js';
import { isUUID } from 'class-validator';
import { callContextFrom } from './call-context.js';

function metadataWith(correlationId?: string): Metadata {
  const metadata = new Metadata();
  if (correlationId !== undefined) {
    metadata.set('x-correlation-id', correlationId);
  }
  return metadata;
}

describe('callContextFrom', () => {
  it('keeps the caller correlation ID', () => {
    expect(callContextFrom(metadataWith('corr-1')).correlationId).toBe(
      'corr-1',
    );
  });

  it('creates an ID when the metadata has none', () => {
    expect(isUUID(callContextFrom(metadataWith()).correlationId)).toBe(true);
  });

  it('replaces a value that could forge a log line', () => {
    expect(callContextFrom(metadataWith('a b')).correlationId).not.toBe('a b');
    expect(
      callContextFrom(metadataWith('x'.repeat(129))).correlationId,
    ).toHaveLength(36);
  });
});
