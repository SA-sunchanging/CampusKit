import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AuthContext, type AuthValue } from './context.ts';
import {
  decodeToken,
  expireSession,
  getToken,
  setToken,
  storeToken,
  subscribeToken,
} from './token.ts';

// Also follow logins and logouts made in other tabs.
function subscribe(listener: () => void): () => void {
  const unsubscribe = subscribeToken(listener);
  window.addEventListener('storage', listener);
  return () => {
    unsubscribe();
    window.removeEventListener('storage', listener);
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, getToken);
  const session = useMemo(() => (token ? decodeToken(token) : null), [token]);

  // Drop an expired or malformed token so it is not sent with requests.
  useEffect(() => {
    if (token && !session) setToken(null);
  }, [token, session]);

  // End the session when the token expires, even if no request sees the 401.
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(expireSession, session.expiresAt - Date.now());
    return () => clearTimeout(timer);
  }, [session]);

  const value = useMemo<AuthValue>(
    () => ({
      user: session ? { id: session.id, role: session.role } : null,
      login: (newToken) => {
        const { id, role } = storeToken(newToken);
        return { id, role };
      },
      logout: () => setToken(null),
    }),
    [session],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
