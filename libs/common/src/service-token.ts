import {
  CanActivate,
  type CustomDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

// Service-to-service authentication (docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md).

/** The header (and gRPC metadata key) that carries the service token; Authorization stays the user's. */
export const SERVICE_TOKEN_HEADER = 'x-service-token';

/** The audience of every service token, so a user token can never pass as one. */
export const INTERNAL_AUDIENCE = 'campuskit-internal';

/** Separate from JWT_SECRET: a leaked user-token secret must not open internal endpoints. */
export const INTERNAL_JWT_SECRET =
  process.env.INTERNAL_JWT_SECRET ?? 'dev-only-internal-secret';

/** A service token lives this long. */
export const SERVICE_TOKEN_TTL_SECONDS = 300;

/** A cached token is replaced this long before it expires, so a slow call never carries a stale one. */
const REFRESH_MARGIN_MS = 60_000;

/** Signs the token a service sends on its internal calls, reusing it until shortly before expiry. */
export class ServiceTokenSigner {
  private readonly jwt: JwtService;
  private cached?: { token: string; expiresAt: number };

  /** @param service the caller's name, as the callee's allowlist spells it, for example "booking". */
  constructor(
    private readonly service: string,
    secret = INTERNAL_JWT_SECRET,
  ) {
    this.jwt = new JwtService({ secret });
  }

  token(): string {
    const now = Date.now();
    if (this.cached && now < this.cached.expiresAt - REFRESH_MARGIN_MS) {
      return this.cached.token;
    }
    const token = this.jwt.sign(
      { sub: this.service },
      {
        algorithm: 'HS256',
        audience: INTERNAL_AUDIENCE,
        expiresIn: SERVICE_TOKEN_TTL_SECONDS,
      },
    );
    this.cached = {
      token,
      expiresAt: now + SERVICE_TOKEN_TTL_SECONDS * 1000,
    };
    return token;
  }
}

export type ServiceTokenCheck =
  | { ok: true; service: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden'; message: string };

/**
 * Checks a service token against the callers an endpoint allows. Unauthenticated when the token
 * is missing, forged, expired, or for another audience; forbidden when it names another service.
 */
export function checkServiceToken(
  jwt: JwtService,
  token: unknown,
  allowed: readonly string[],
): ServiceTokenCheck {
  if (typeof token !== 'string' || token === '') {
    return {
      ok: false,
      reason: 'unauthenticated',
      message: 'Missing service token',
    };
  }
  let service: unknown;
  try {
    const claims = jwt.verify<{ sub?: unknown; exp?: unknown }>(token, {
      algorithms: ['HS256'],
      audience: INTERNAL_AUDIENCE,
    });
    service = typeof claims.exp === 'number' ? claims.sub : undefined;
  } catch {
    service = undefined;
  }
  if (typeof service !== 'string' || service === '') {
    return {
      ok: false,
      reason: 'unauthenticated',
      message: 'Invalid service token',
    };
  }
  if (!allowed.includes(service)) {
    return {
      ok: false,
      reason: 'forbidden',
      message: `The ${service} service may not call this endpoint`,
    };
  }
  return { ok: true, service };
}

const INTERNAL_CALLERS = 'campuskit:internal-callers';

/**
 * The services allowed to call a controller or route guarded by InternalAuthGuard. A route's
 * list replaces its controller's.
 */
export const InternalCallers = (...services: string[]): CustomDecorator =>
  SetMetadata(INTERNAL_CALLERS, services);

/**
 * Accepts only requests with a valid service token from a service named by @InternalCallers:
 * 401 for a missing or invalid token, 403 for another service. Without @InternalCallers every
 * caller is refused.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly jwt = new JwtService({ secret: INTERNAL_JWT_SECRET });

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed =
      this.reflector.getAllAndOverride<string[] | undefined>(INTERNAL_CALLERS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const req = context.switchToHttp().getRequest<Request>();
    const check = checkServiceToken(
      this.jwt,
      req.headers[SERVICE_TOKEN_HEADER],
      allowed,
    );
    if (!check.ok) {
      throw check.reason === 'forbidden'
        ? new ForbiddenException(check.message)
        : new UnauthorizedException(check.message);
    }
    return true;
  }
}
