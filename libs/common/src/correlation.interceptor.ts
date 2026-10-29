import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import {
  correlationIdFrom,
  runWithCorrelationId,
} from './correlation-context.js';
import { CORRELATION_HEADER } from './correlation-id.middleware.js';

/**
 * Runs each handler under the caller's correlation ID: the x-correlation-id header of an HTTP
 * request or the metadata of a gRPC call. A missing or malformed ID is replaced with a new one
 * and written back, so the handler, its outgoing calls, and its events all use the same ID.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const id =
      context.getType() === 'rpc'
        ? fromMetadata(context.switchToRpc().getContext<Metadata>())
        : fromRequest(context.switchToHttp().getRequest<Request>());
    // Nest runs the handler in the async context in which handle() is called.
    return runWithCorrelationId(id, () => next.handle());
  }
}

function fromRequest(req: Request): string {
  const id = correlationIdFrom(req.headers[CORRELATION_HEADER]);
  req.headers[CORRELATION_HEADER] = id;
  return id;
}

function fromMetadata(metadata: Metadata): string {
  const id = correlationIdFrom(metadata.get(CORRELATION_HEADER)[0]);
  metadata.set(CORRELATION_HEADER, id);
  return id;
}
