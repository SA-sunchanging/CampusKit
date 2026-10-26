import { expireSession, getToken } from '../auth/token.ts';

// Every call goes to the API gateway under /api. Services are never called directly.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  // A 401 on a call that sent a token means the token is expired or revoked.
  // Without a token (for example a failed login) there is nothing to forget.
  if (res.status === 401 && token) expireSession();
  const body = res.status === 204 ? undefined : await res.json();
  if (!res.ok) {
    // Services answer errors as { error: { code, message } }.
    throw new Error(
      body?.error?.message ?? `Request failed with ${res.status}`,
    );
  }
  return body as T;
}
