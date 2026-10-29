import type { NextFunction, Request, Response } from 'express';
import {
  correlationIdFrom,
  runWithCorrelationId,
} from './correlation-context.js';

export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Reuses the caller's correlation ID or creates one, so one request can be traced across services.
 * A malformed caller value is replaced, never trusted. The rest of the request runs under the ID,
 * so every log line it writes carries it.
 */
export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = correlationIdFrom(req.header(CORRELATION_HEADER));
  req.headers[CORRELATION_HEADER] = id;
  res.setHeader(CORRELATION_HEADER, id);
  runWithCorrelationId(id, next);
}
