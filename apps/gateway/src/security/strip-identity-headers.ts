import type { NextFunction, Request, Response } from 'express';

/**
 * Client headers that look like identity claims (x-user-id, x-auth-user, x-role, ...).
 * Services take identity only from the JWT, so these never travel past the gateway.
 */
const IDENTITY_HEADER = /^(x-user-|x-auth-|x-role|x-forwarded-user$)/;

/** Removes identity-like headers so no service can mistake them for a verified identity. */
export function stripIdentityHeaders(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Node lowercases incoming header names.
  for (const name of Object.keys(req.headers)) {
    if (IDENTITY_HEADER.test(name)) {
      delete req.headers[name];
    }
  }
  next();
}
