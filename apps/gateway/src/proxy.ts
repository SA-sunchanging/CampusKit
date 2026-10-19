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
      rejectInvalidToken,
      createProxyMiddleware({ target, changeOrigin: true }),
    );
  }
}
