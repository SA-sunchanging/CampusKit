import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  Module,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

/** Claims in a CampusKit JWT. Keep them minimal; ask the owning service for anything else. */
export interface AuthUser {
  sub: string;
  role: 'student' | 'admin';
}

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret';

const ROLES: readonly string[] = ['student', 'admin'];

/** The token in an `Authorization: Bearer <token>` header, or undefined when there is none. */
export function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  const token = header.slice('Bearer '.length).trim();
  return token === '' ? undefined : token;
}

/**
 * Verifies a CampusKit JWT and returns its claims. Accepts only HS256, so `alg: none` and
 * tokens signed with another algorithm fail, and requires a UUID `sub`, a known `role`, and
 * an `exp`, so a token cannot live forever and a bad user ID never reaches a database query.
 * Throws when the token is invalid, expired, or carries the wrong claims.
 */
export function verifyAccessToken(jwt: JwtService, token: string): AuthUser {
  const claims = jwt.verify<Partial<AuthUser> & { exp?: unknown }>(token, {
    algorithms: ['HS256'],
  });
  if (
    typeof claims.sub !== 'string' ||
    !isUUID(claims.sub) ||
    typeof claims.exp !== 'number' ||
    typeof claims.role !== 'string' ||
    !ROLES.includes(claims.role)
  ) {
    throw new Error('Token is missing required claims');
  }
  return { sub: claims.sub, role: claims.role };
}

/** Rejects requests without a valid JWT and puts the claims on request.user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = bearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      req.user = verifyAccessToken(this.jwt, token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }
}

/** Injects the authenticated caller: `method(@CurrentUser() user: AuthUser)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);

@Module({
  imports: [JwtModule.register({ secret: JWT_SECRET })],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
