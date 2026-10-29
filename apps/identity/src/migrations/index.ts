import { CreateAccounts1793025647089 } from './1793025647089-create-accounts.js';
import { CreateEmailVerifications1793500000000 } from './1793500000000-create-email-verifications.js';
import { CreateOutbox1793500100000 } from './1793500100000-create-outbox.js';
import { ReviewStudentStatus1793500200000 } from './1793500200000-review-student-status.js';

/**
 * Migrations for identity_db, run in order at startup. Import each migration class here.
 * Create one with a timestamped class that implements MigrationInterface (up/down with raw SQL).
 */
export const migrations: Function[] = [
  CreateAccounts1793025647089,
  CreateEmailVerifications1793500000000,
  CreateOutbox1793500100000,
  ReviewStudentStatus1793500200000,
];
