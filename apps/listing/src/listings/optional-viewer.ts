import { type AuthUser, bearerToken, verifyAccessToken } from '@app/common';
import type { JwtService } from '@nestjs/jwt';

/**
 * The caller of a public route when it sends a valid token, otherwise null. A missing,
 * expired, or forged token makes the caller a guest instead of failing the request.
 */
export function optionalViewer(
  authorization: string | undefined,
  jwt: JwtService,
): AuthUser | null {
  const token = bearerToken(authorization);
  if (!token) {
    return null;
  }
  try {
    return verifyAccessToken(jwt, token);
  } catch {
    return null;
  }
}
