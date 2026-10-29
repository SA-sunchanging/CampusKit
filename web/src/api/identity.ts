import { api } from './client.ts';

// Identity service calls through the gateway (role A).

/**
 * UNSUBMITTED until the student submits a student ID (PENDING); an administrator then approves
 * (VERIFIED) or rejects it (REJECTED, which the student may submit again).
 */
export type StudentStatus = 'UNSUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  emailVerified: boolean;
  studentStatus: StudentStatus;
  /** The student ID submitted for review. */
  studentId: string | null;
  /** The administrator's reason. Set only on a REJECTED status. */
  studentRejectionReason: string | null;
  createdAt: string;
}

/** A new email verification code. */
export interface EmailCode {
  expiresAt: string;
  /** The code itself, only in demo mode, which sends no email. */
  demoCode?: string;
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

/** Issues a new code; 429 within a minute of the last one, 409 once verified. */
export function requestEmailCode(): Promise<EmailCode> {
  return api('/identity/accounts/me/email-verification', { method: 'POST' });
}

/** Confirms the code; 400 for a wrong code, 410 when it expired or was used up. */
export function confirmEmail(code: string): Promise<Profile> {
  return api('/identity/accounts/me/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** Submits the 10-digit student ID for review; needs a verified email. */
export function submitStudentId(studentId: string): Promise<Profile> {
  return api('/identity/accounts/me/student-status', {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}
