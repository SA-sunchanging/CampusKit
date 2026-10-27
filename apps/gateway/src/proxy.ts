import type { INestApplication } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * REST services behind the gateway: /api/<service>/<path> is forwarded to <service>/<path>.
 * Booking is not here; it speaks gRPC and has its own routes in ./booking.
 * Addresses come from the environment (Docker Compose DNS names), never from hard-coded IPs.
 */
export function serviceTargets(): Record<string, string> {
  return {
    identity: process.env.IDENTITY_URL ?? 'http://localhost:3001',
    listing: process.env.LISTING_URL ?? 'http://localhost:3002',
    rental: process.env.RENTAL_URL ?? 'http://localhost:3003',
    payment: process.env.PAYMENT_URL ?? 'http://localhost:3004',
    review: process.env.REVIEW_URL ?? 'http://localhost:3005',
    notification: process.env.NOTIFICATION_URL ?? 'http://localhost:3006',
  };
}

/** Forwards each service's path. The security chain in ./gateway.setup runs before it. */
export function registerProxies(
  app: INestApplication,
  targets: Record<string, string> = serviceTargets(),
): void {
  for (const [service, target] of Object.entries(targets)) {
    app.use(
      `/api/${service}`,
      createProxyMiddleware({ target, changeOrigin: true }),
    );
  }
}
