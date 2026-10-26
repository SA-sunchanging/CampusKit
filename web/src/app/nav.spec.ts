import { describe, expect, it } from 'vitest';
import { canAccess, navFor } from './nav.ts';

const labels = (viewer: Parameters<typeof navFor>[0]) =>
  navFor(viewer).map((item) => item.label);

describe('navFor', () => {
  it('offers a guest the listings, log in, and register', () => {
    expect(labels('guest')).toEqual(['Listings', 'Log in', 'Register']);
  });

  it('offers a student every student page and no admin page', () => {
    expect(labels('student')).toEqual([
      'Listings',
      'Bookings',
      'Rentals',
      'Inbox',
      'Reviews',
      'Account',
    ]);
  });

  it('offers an admin only admin, listings, and account', () => {
    expect(labels('admin')).toEqual(['Admin', 'Listings', 'Account']);
  });
});

describe('canAccess', () => {
  it('lets no guest through a guard', () => {
    expect(canAccess('guest', 'user')).toBe(false);
    expect(canAccess('guest', 'student')).toBe(false);
    expect(canAccess('guest', 'admin')).toBe(false);
  });

  it('lets any logged-in role through a user guard', () => {
    expect(canAccess('student', 'user')).toBe(true);
    expect(canAccess('admin', 'user')).toBe(true);
  });

  it('lets only the matching role through a role guard', () => {
    expect(canAccess('student', 'student')).toBe(true);
    expect(canAccess('admin', 'admin')).toBe(true);
    expect(canAccess('student', 'admin')).toBe(false);
    expect(canAccess('admin', 'student')).toBe(false);
  });
});
