import type { Location } from 'react-router';

/** Where to go after login: the page the guard remembered, else home. */
export function returnTo(state: unknown): string {
  const from = (state as { from?: Partial<Location> } | null)?.from;
  const path = from?.pathname;
  if (!path || path === '/login' || !isAppPath(path)) return '/';
  return `${path}${from.search ?? ''}${from.hash ?? ''}`;
}

// Only a path inside this app: `//host` and `/\host` would leave the site.
function isAppPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}
