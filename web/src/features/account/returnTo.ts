import type { Location } from 'react-router';

/** Where to go after login: the page the guard remembered, else home. */
export function returnTo(state: unknown): string {
  const from = (state as { from?: Partial<Location> } | null)?.from;
  if (!from?.pathname || from.pathname === '/login') return '/';
  return `${from.pathname}${from.search ?? ''}`;
}
