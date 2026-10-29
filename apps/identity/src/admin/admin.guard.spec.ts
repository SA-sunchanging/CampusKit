import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard.js';

const id = '00000000-0000-4000-8000-000000000001';

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('lets an administrator through', () => {
    expect(guard.canActivate(contextFor({ sub: id, role: 'admin' }))).toBe(
      true,
    );
  });

  it('refuses a student with 403', () => {
    expect(() =>
      guard.canActivate(contextFor({ sub: id, role: 'student' })),
    ).toThrow(ForbiddenException);
  });

  it('refuses a request without a user', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
