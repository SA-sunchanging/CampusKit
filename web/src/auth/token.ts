// Access token storage and decoding (role A). The gateway verifies the signature;
// the web app only reads the claims to decide what to show.
export type Role = 'student' | 'admin';

export interface Session {
  id: string;
  role: Role;
  /** Expiry time in milliseconds since the epoch. */
  expiresAt: number;
}

export const TOKEN_KEY = 'campuskit.token';

const ROLES: readonly string[] = ['student', 'admin'];

interface Claims {
  sub: string;
  role: Role;
  exp: number;
}

function isClaims(value: unknown): value is Claims {
  if (typeof value !== 'object' || value === null) return false;
  const claims = value as Record<string, unknown>;
  return (
    typeof claims.sub === 'string' &&
    typeof claims.role === 'string' &&
    ROLES.includes(claims.role) &&
    typeof claims.exp === 'number' &&
    Number.isFinite(claims.exp)
  );
}

function decodePayload(payload: string): unknown {
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Returns the session in a token, or null when it is malformed, expired, or has an unknown role. */
export function decodeToken(token: string, now = Date.now()): Session | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let claims: unknown;
  try {
    claims = decodePayload(parts[1]);
  } catch {
    return null;
  }
  if (!isClaims(claims)) return null;
  const expiresAt = claims.exp * 1000;
  if (expiresAt <= now) return null;
  return { id: claims.sub, role: claims.role, expiresAt };
}

const changeListeners = new Set<() => void>();
const expiredListeners = new Set<() => void>();

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  changeListeners.forEach((listener) => listener());
}

/** Calls the listener whenever the stored token changes. Returns an unsubscribe function. */
export function subscribeToken(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** The server rejected the token: forget it and tell the app to ask for a new login. */
export function expireSession(): void {
  setToken(null);
  expiredListeners.forEach((listener) => listener());
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}
