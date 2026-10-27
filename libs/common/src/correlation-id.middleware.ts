import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

/** Short and log-safe: no spaces, line breaks, or other characters that could forge a log line. */
const VALID_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Reuses the caller's correlation ID or creates one, so one request can be traced across services.
 * A malformed caller value is replaced, never trusted.
 */
export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const given = req.header(CORRELATION_HEADER);
  const id = given !== undefined && VALID_ID.test(given) ? given : randomUUID();
  req.headers[CORRELATION_HEADER] = id;
  res.setHeader(CORRELATION_HEADER, id);
  next();
}
