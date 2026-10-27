import { HttpStatus, Logger, type INestApplication } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';

const logger = new Logger('Proxy');

/** A service that has not answered within this time counts as unavailable. */
const PROXY_TIMEOUT_MS = 15_000;

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

/**
 * Answers a failed forward (service down, unknown host, timeout) with 502 in the shared error
 * shape, instead of the proxy library's plain-text message that names the internal address.
 */
export function proxyErrorHandler(service: string) {
  return (
    err: Error,
    req: IncomingMessage,
    res: ServerResponse | Socket,
  ): void => {
    logger.warn(
      `${service} unavailable for ${req.method} ${req.url} ` +
        `(correlation ${String(req.headers['x-correlation-id'])}): ${err.message}`,
    );
    if (!('writeHead' in res)) {
      res.destroy();
      return;
    }
    if (!res.headersSent) {
      res.writeHead(HttpStatus.BAD_GATEWAY, {
        'content-type': 'application/json',
      });
    }
    res.end(
      JSON.stringify({
        error: {
          code: HttpStatus[HttpStatus.BAD_GATEWAY],
          message: `The ${service} service is unavailable`,
        },
      }),
    );
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
      createProxyMiddleware({
        target,
        changeOrigin: true,
        proxyTimeout: PROXY_TIMEOUT_MS,
        on: { error: proxyErrorHandler(service) },
      }),
    );
  }
}
