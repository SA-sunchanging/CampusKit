import { randomUUID } from 'node:crypto';
import { CORRELATION_HEADER } from '@app/common';
import type { Metadata } from '@grpc/grpc-js';

/** Same rule as the gateway's correlation-ID middleware: short and log-safe. */
const VALID_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** What a downstream call and an event need from the incoming gRPC call. */
export interface CallContext {
  correlationId: string;
}

/**
 * Reads the "x-correlation-id" metadata of a gRPC call. A missing or malformed value is
 * replaced with a new UUID, so every HTTP call and event still carries a trace ID.
 */
export function callContextFrom(metadata: Metadata): CallContext {
  const value = metadata.get(CORRELATION_HEADER)[0];
  return {
    correlationId:
      typeof value === 'string' && VALID_ID.test(value) ? value : randomUUID(),
  };
}
