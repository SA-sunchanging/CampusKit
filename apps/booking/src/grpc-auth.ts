import { type AuthUser, bearerToken, verifyAccessToken } from '@app/common';
import { Metadata, status } from '@grpc/grpc-js';
import type { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';

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
