import type { Account, Role, StudentStatus } from './account.entity.js';

/** What an account looks like to its owner. Never includes the password hash. */
export interface Profile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  emailVerified: boolean;
  studentStatus: StudentStatus;
  createdAt: Date;
}

export function toProfile(account: Account): Profile {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    emailVerified: account.emailVerifiedAt !== null,
    studentStatus: account.studentStatus,
    createdAt: account.createdAt,
  };
}
