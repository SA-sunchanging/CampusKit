import { CORRELATION_HEADER } from '@app/common';
import { Metadata } from '@grpc/grpc-js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'node:http';

/**
 * The gRPC metadata Booking expects on every call (libs/contracts/proto/booking.proto): the
 * caller's "Authorization" header unchanged and the request's correlation ID. A header the
 * request does not carry is left out.
 */
export function toGrpcMetadata(headers: IncomingHttpHeaders): Metadata {
  const metadata = new Metadata();
  const authorization = headers.authorization;
  if (authorization) {
    metadata.set('authorization', authorization);
  }
  const correlationId = headers[CORRELATION_HEADER];
  if (typeof correlationId === 'string' && correlationId) {
    metadata.set(CORRELATION_HEADER, correlationId);
  }
  return metadata;
}

/** Injects the gRPC metadata for the current request: `method(@CallMetadata() metadata: Metadata)`. */
export const CallMetadata = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Metadata =>
    toGrpcMetadata(context.switchToHttp().getRequest<Request>().headers),
);
