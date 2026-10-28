import { CORRELATION_HEADER } from '@app/common';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** What a downstream call needs from the incoming request: the caller's token and the trace ID. */
export interface CallContext {
  /** The full "Bearer <JWT>" header value, forwarded unchanged. */
  authorization: string;
  correlationId: string;
}

/** Injects the CallContext of the current request: `method(@Call() call: CallContext)`. */
export const Call = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CallContext => {
    const req = context.switchToHttp().getRequest<Request>();
    return {
      authorization: req.headers.authorization ?? '',
      correlationId: String(req.headers[CORRELATION_HEADER] ?? ''),
    };
  },
);
