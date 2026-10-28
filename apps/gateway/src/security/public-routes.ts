/** Routes a caller can reach without logging in. Everything else under /api needs a valid JWT. */
const PUBLIC_ROUTES: readonly { method: string; path: string }[] = [
  { method: 'POST', path: '/api/identity/accounts' },
  { method: 'POST', path: '/api/identity/auth/login' },
];

/** GET /api/<service>/health of every service behind the gateway. */
const HEALTH_PATH = /^\/api\/[a-z]+\/health$/;

/** Listing search and detail, so guests can browse before they register. Lowercase UUIDs only. */
const PUBLIC_GET_PATHS: readonly RegExp[] = [
  HEALTH_PATH,
  /^\/api\/listing\/listings$/,
  /^\/api\/listing\/listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
];

/**
 * True when the route is public. The path is matched exactly as received (no decoding,
 * no trailing slash), so any unusual spelling of a public path simply needs a token.
 */
export function isPublicRoute(method: string, path: string): boolean {
  if (
    method === 'GET' &&
    PUBLIC_GET_PATHS.some((pattern) => pattern.test(path))
  ) {
    return true;
  }
  return PUBLIC_ROUTES.some(
    (route) => route.method === method && route.path === path,
  );
}
