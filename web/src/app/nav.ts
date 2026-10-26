import type { Role } from '../auth/token.ts';

// Role-based navigation (role A). This only shapes the UI; the services
// decide what each caller may do.
export type Viewer = Role | 'guest';

/** 'user' means any logged-in role. */
export type Requirement = Role | 'user';

export interface NavItem {
  to: string;
  label: string;
}

const NAV: Record<Viewer, NavItem[]> = {
  guest: [
    { to: '/', label: 'Listings' },
    { to: '/login', label: 'Log in' },
    { to: '/register', label: 'Register' },
  ],
  student: [
    { to: '/', label: 'Listings' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/rentals', label: 'Rentals' },
    { to: '/inbox', label: 'Inbox' },
    { to: '/reviews', label: 'Reviews' },
    { to: '/account', label: 'Account' },
  ],
  admin: [
    { to: '/admin', label: 'Admin' },
    { to: '/', label: 'Listings' },
    { to: '/account', label: 'Account' },
  ],
};

export function navFor(viewer: Viewer): NavItem[] {
  return NAV[viewer];
}

export function canAccess(viewer: Viewer, required: Requirement): boolean {
  if (viewer === 'guest') return false;
  return required === 'user' || viewer === required;
}
