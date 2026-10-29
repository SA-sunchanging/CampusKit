import type { AuthUser } from '@app/common';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/** Lets only administrators through. Use after JwtAuthGuard, which sets request.user. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Only an administrator can do this');
    }
    return true;
  }
}
