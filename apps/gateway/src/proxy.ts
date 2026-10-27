import { JWT_SECRET } from '@app/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * REST services behind the gateway: /api/<service>/<path> is forwarded to <service>/<path>.
 * Booking is not here; it speaks gRPC and has its own routes in ./booking.
 * Addresses come from the environment (Docker Compose DNS names), never from hard-coded IPs.
 */
const routes: Record<string, string> = {
  identity: process.env.IDENTITY_URL ?? 'http://localhost:3001',
  listing: process.env.LISTING_URL ?? 'http://localhost:3002',
  rental: process.env.RENTAL_URL ?? 'http://localhost:3003',
  payment: process.env.PAYMENT_URL ?? 'http://localhost:3004',
  review: process.env.REVIEW_URL ?? 'http://localhost:3005',
  notification: process.env.NOTIFICATION_URL ?? 'http://localhost:3006',
};

const jwt = new JwtService({ secret: JWT_SECRET });

/** Decodes until stable, so double-encoded segments such as %2569nternal are caught too. */
function fullyDecode(path: string): string {
  let current = path;
  for (let i = 0; i < 5; i++) {
    const next = decodeURIComponent(current);
    if (next === current) {
      return next;
    }
    current = next;
  }
  return current;
}

/**
 * True when any segment of the path is `internal`, ignoring case and percent-encoding.
 * Checking every segment also covers //internal, /./internal and /x/../internal.
 * Throws URIError when the path is not valid percent-encoding.
 */
export function isInternalPath(url: string): boolean {
  const path = fullyDecode(url.split('?')[0]).toLowerCase();
  return path.split(/[/\\]/).includes('internal');
}

/** Service-to-service endpoints under /internal are never reachable from outside. */
export function rejectInternalPath(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  let internal: boolean;
  try {
    internal = isInternalPath(req.url);
  } catch {
    res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Malformed path' } });
    return;
  }
  if (internal) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }
  next();
}

/** Rejects a request whose bearer token is present but invalid. Services still authorise each request. */
function rejectInvalidToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      jwt.verify(header.slice('Bearer '.length));
    } catch {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
      return;
    }
  }
  next();
}

export function registerProxies(app: INestApplication): void {
  for (const [service, target] of Object.entries(routes)) {
    app.use(
      `/api/${service}`,
      rejectInternalPath,
      rejectInvalidToken,
      createProxyMiddleware({ target, changeOrigin: true }),
    );
  }
}
