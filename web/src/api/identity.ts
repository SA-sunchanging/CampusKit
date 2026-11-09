import { api } from './client.ts';

// Identity service calls through the gateway (role A).

/**
 * UNSUBMITTED until the student submits a student ID (PENDING); an administrator then approves
 * (VERIFIED) or rejects it (REJECTED, which the student may submit again).
 */
export type StudentStatus = 'UNSUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PayoutProfile {
  method: 'PROMPTPAY';
  promptPayId: string;
  accountName: string;
}

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
  payoutProfile: PayoutProfile | null;
  createdAt: string;
}

/** A new email verification code. */
export interface EmailCode {
  expiresAt: string;
  /** The code itself, only in demo mode, which sends no email. */
  demoCode?: string;
}

/** A student in the administrator's review queue. */
export interface StudentReviewItem {
  id: string;
  email: string;
  displayName: string;
  studentId: string | null;
  studentStatus: StudentStatus;
  submittedAt: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface StudentQueue {
  items: StudentReviewItem[];
  total: number;
  page: number;
  pageSize: number;
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

/** Saves the student's payout destination; required before publishing a listing. */
export function setPayoutProfile(
  profile: PayoutProfile,
): Promise<PayoutProfile> {
  return api('/identity/accounts/me/payout-profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
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

/** Builds "?status=...&page=..." for the student queue, leaving out page 1. */
export function studentQueueQuery(status: StudentStatus, page = 1): string {
  const query = new URLSearchParams({ status });
  if (page > 1) query.set('page', String(page));
  return `?${query.toString()}`;
}

/** Students in a status, oldest submission first (waiting for review by default). Admin only. */
export function getStudentQueue(
  status: StudentStatus = 'PENDING',
  page = 1,
): Promise<StudentQueue> {
  return api(`/identity/admin/students${studentQueueQuery(status, page)}`);
}

/** Verifies a PENDING student. Admin only; 409 for any other status. */
export function approveStudent(id: string): Promise<StudentReviewItem> {
  return api(`/identity/admin/students/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });
}

/** Rejects a PENDING student; the student sees the reason. Admin only. */
export function rejectStudent(
  id: string,
  reason: string,
): Promise<StudentReviewItem> {
  return api(`/identity/admin/students/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
