// Every call goes to the API gateway under /api. Services are never called directly.
const TOKEN_KEY = 'campuskit.token';

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = res.status === 204 ? undefined : await res.json();
  if (!res.ok) {
    // Services answer errors as { error: { code, message } }.
    throw new Error(
      body?.error?.message ?? `Request failed with ${res.status}`,
    );
  }
  return body as T;
}
