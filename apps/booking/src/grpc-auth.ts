import {
  type AuthUser,
  bearerToken,
  checkServiceToken,
  INTERNAL_JWT_SECRET,
  SERVICE_TOKEN_HEADER,
  verifyAccessToken,
} from '@app/common';
import { Metadata, status } from '@grpc/grpc-js';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';

/** Verifies service tokens, which use their own secret, not the user-token one. */
const serviceJwt = new JwtService({ secret: INTERNAL_JWT_SECRET });

/**
 * The caller of a gRPC method, read from the "authorization: Bearer <JWT>" metadata
 * (libs/contracts/proto/booking.proto). Throws UNAUTHENTICATED when the token is missing or invalid.
 */
export function callerFrom(metadata: Metadata, jwt: JwtService): AuthUser {
  const header = metadata.get('authorization')[0];
  const token = bearerToken(typeof header === 'string' ? header : undefined);
  if (!token) {
    throw new RpcException({
      code: status.UNAUTHENTICATED,
      message: 'Missing bearer token',
    });
  }
  try {
    return verifyAccessToken(jwt, token);
  } catch {
    throw new RpcException({
      code: status.UNAUTHENTICATED,
      message: 'Invalid token',
    });
  }
}

/**
 * Accepts a method that only services call when the "x-service-token" metadata names one of the
 * allowed services (docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md).
 * Throws UNAUTHENTICATED when the token is missing or invalid, and PERMISSION_DENIED when it
 * names another service. Methods the gateway calls for a user rely on the user token alone.
 */
export function requireService(
  metadata: Metadata,
  allowed: readonly string[],
): void {
  const check = checkServiceToken(
    serviceJwt,
    metadata.get(SERVICE_TOKEN_HEADER)[0],
    allowed,
  );
  if (!check.ok) {
    throw new RpcException({
      code:
        check.reason === 'forbidden'
          ? status.PERMISSION_DENIED
          : status.UNAUTHENTICATED,
      message: check.message,
    });
  }
}
