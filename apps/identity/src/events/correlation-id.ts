import { CORRELATION_HEADER } from '@app/common';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Injects the request's correlation ID, which the correlation middleware always sets, so an
 * event can carry it: `method(@CorrelationId() correlationId: string)`.
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    String(
      context.switchToHttp().getRequest<Request>().headers[
        CORRELATION_HEADER
      ] ?? '',
    ),
);
