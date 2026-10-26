import { api } from './client.ts';

// Identity service calls through the gateway (role A).
export interface Profile {
  id: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  emailVerified: boolean;
  studentStatus: 'UNSUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  displayName: string;
}

export interface LoginResult {
  accessToken: string;
  /** Token lifetime in seconds. */
  expiresIn: number;
}

export function login(credentials: Credentials): Promise<LoginResult> {
  return api('/identity/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function register(registration: Registration): Promise<Profile> {
  return api('/identity/accounts', {
    method: 'POST',
    body: JSON.stringify(registration),
  });
}

/** Registering returns no token, so log in with the same credentials right after. */
export async function registerAndLogin(
  registration: Registration,
): Promise<LoginResult> {
  await register(registration);
  return login({ email: registration.email, password: registration.password });
}

export function getMe(): Promise<Profile> {
  return api('/identity/accounts/me');
}
