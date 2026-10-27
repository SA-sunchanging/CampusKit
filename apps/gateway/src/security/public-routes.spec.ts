import { isPublicRoute } from './public-routes.js';

describe('isPublicRoute', () => {
  it.each([
    ['POST', '/api/identity/accounts'],
    ['POST', '/api/identity/auth/login'],
    ['GET', '/api/identity/health'],
    ['GET', '/api/listing/health'],
    ['GET', '/api/notification/health'],
  ])('%s %s is public', (method, path) => {
    expect(isPublicRoute(method, path)).toBe(true);
  });

  it.each([
    ['GET', '/api/identity/accounts'],
    ['GET', '/api/identity/accounts/me'],
    ['PUT', '/api/identity/accounts/me/payout-profile'],
    ['GET', '/api/identity/auth/login'],
    ['POST', '/api/listing/health'],
    ['GET', '/api/listing/listings'],
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
