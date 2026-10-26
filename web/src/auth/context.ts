import { createContext } from 'react';
import type { Role } from './token.ts';

export interface AuthUser {
  id: string;
  role: Role;
}

export interface AuthValue {
  /** The logged-in user, or null for a guest. */
  user: AuthUser | null;
  /** Stores the access token from a login response. */
  login(token: string): AuthUser;
  /** Deletes the token; the server keeps no session to end. */
  logout(): void;
}

export const AuthContext = createContext<AuthValue | null>(null);
