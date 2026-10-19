import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

/** Reuses the caller's correlation ID or creates one, so one request can be traced across services. */
export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = req.header(CORRELATION_HEADER) ?? randomUUID();
  req.headers[CORRELATION_HEADER] = id;
  res.setHeader(CORRELATION_HEADER, id);
  next();
}
