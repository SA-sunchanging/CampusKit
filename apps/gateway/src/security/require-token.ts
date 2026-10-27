import { bearerToken, JWT_SECRET, verifyAccessToken } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { isPublicRoute } from './public-routes.js';

const jwt = new JwtService({ secret: JWT_SECRET });

function unauthorized(res: Response, message: string): void {
  res.status(401).json({ error: { code: 'UNAUTHORIZED', message } });
}

/**
 * Lets public routes through untouched, so a stale token never blocks login, and rejects
 * every other request without a valid JWT. Services still authorise each request.
 */
export function requireToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isPublicRoute(req.method, req.baseUrl + req.path)) {
    next();
    return;
  }
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    unauthorized(res, 'Missing bearer token');
    return;
  }
  try {
    verifyAccessToken(jwt, token);
  } catch {
    unauthorized(res, 'Invalid token');
    return;
  }
  next();
}
