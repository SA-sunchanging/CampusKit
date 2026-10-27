import type { INestApplication } from '@nestjs/common';
import { json } from 'express';
import { registerProxies, serviceTargets } from './proxy.js';
import { rejectInternalPath } from './security/internal-path.js';
import { requireToken } from './security/require-token.js';

/**
 * Wires the gateway's security chain and routes. The chain covers all of /api, both the
 * proxied REST services and the gateway's own booking routes; the correlation ID middleware
 * from createHttpService runs before it.
 */
export function configureGateway(
  app: INestApplication,
  targets: Record<string, string> = serviceTargets(),
): void {
  app.use('/api', rejectInternalPath, requireToken);
  // The proxy forwards raw request bodies, so only the gRPC-backed booking routes parse JSON.
  app.use('/api/booking', json());
  registerProxies(app, targets);
}
