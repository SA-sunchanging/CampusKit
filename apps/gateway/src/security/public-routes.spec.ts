import { isPublicRoute } from './public-routes.js';

describe('isPublicRoute', () => {
  it.each([
    ['POST', '/api/identity/accounts'],
    ['POST', '/api/identity/auth/login'],
    ['GET', '/api/identity/health'],
    ['GET', '/api/listing/health'],
    ['GET', '/api/notification/health'],
    ['GET', '/api/listing/listings'],
    ['GET', '/api/listing/listings/11111111-1111-4111-8111-111111111111'],
  ])('%s %s is public', (method, path) => {
    expect(isPublicRoute(method, path)).toBe(true);
  });

  it.each([
    ['GET', '/api/identity/accounts'],
    ['GET', '/api/identity/accounts/me'],
    ['PUT', '/api/identity/accounts/me/payout-profile'],
    ['POST', '/api/identity/accounts/me/email-verification'],
    ['POST', '/api/identity/accounts/me/email-verification/confirm'],
    ['POST', '/api/identity/accounts/me/student-status'],
    ['GET', '/api/identity/admin/students'],
    [
      'POST',
      '/api/identity/admin/students/11111111-1111-4111-8111-111111111111/approve',
    ],
    ['GET', '/api/identity/auth/login'],
    ['POST', '/api/listing/health'],
    ['POST', '/api/listing/listings'],
    [
      'POST',
      '/api/listing/listings/11111111-1111-4111-8111-111111111111/publish',
    ],
    ['GET', '/api/listing/listings/'],
    ['GET', '/api/listing/listings/new'],
    ['GET', '/api/listing/listings/11111111-1111-4111-8111-111111111111/x'],
    ['GET', '/api/listing/listings/..%2F..%2Fidentity%2Faccounts%2Fme'],
    ['GET', '/api/booking/bookings/b1'],
    ['POST', '/api/identity/accounts/'],
    ['POST', '/api/identity/Accounts'],
    ['GET', '/api/identity/health/../accounts/me'],
    ['GET', '/api/identity/health/x'],
    ['POST', '/api/listing/accounts'],
  ])('%s %s needs a token', (method, path) => {
    expect(isPublicRoute(method, path)).toBe(false);
  });
});
