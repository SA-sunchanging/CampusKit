import { describe, expect, it } from 'vitest';
import { returnTo } from './returnTo.ts';

describe('returnTo', () => {
  it('returns to the remembered page and its query', () => {
    expect(returnTo({ from: { pathname: '/bookings', search: '?id=1' } })).toBe(
      '/bookings?id=1',
    );
  });

  it('goes home when nothing was remembered', () => {
    expect(returnTo(null)).toBe('/');
    expect(returnTo({})).toBe('/');
  });

  it('never returns to the login page itself', () => {
    expect(returnTo({ from: { pathname: '/login' } })).toBe('/');
  });
});
