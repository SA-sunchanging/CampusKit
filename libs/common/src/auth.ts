import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  Module,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/** Claims in a CampusKit JWT. Keep them minimal; ask the owning service for anything else. */
export interface AuthUser {
  sub: string;
  role: 'student' | 'admin';
}

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret';

/** Rejects requests without a valid JWT and puts the claims on request.user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      req.user = this.jwt.verify<AuthUser>(header.slice('Bearer '.length));
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
