import type { Role, StudentStatus } from '../accounts/account.entity.js';
import type { PayoutProfile } from '../accounts/payout-profile.js';

/** Every demo account uses this password. Demo value only, like the database passwords in infra/. */
export const DEMO_PASSWORD = 'campuskit-demo';

/** A fixed time, so seeding again leaves the same row. */
export const DEMO_VERIFIED_AT = new Date('2026-10-01T00:00:00Z');

export interface DemoAccount {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  studentStatus: StudentStatus;
  payoutProfile: PayoutProfile | null;
}

/** Fixed IDs, so other services and scripts/dev-token.mjs can refer to these accounts after a reset. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'somchai@student.chula.ac.th',
    displayName: 'Somchai Jaidee',
    role: 'student',
    studentStatus: 'VERIFIED',
    payoutProfile: {
      method: 'PROMPTPAY',
      promptPayId: '0812345678',
      accountName: 'Somchai Jaidee',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'malee@student.chula.ac.th',
    displayName: 'Malee Srisuk',
    role: 'student',
    studentStatus: 'VERIFIED',
    payoutProfile: {
      method: 'PROMPTPAY',
      promptPayId: '0898765432',
      accountName: 'Malee Srisuk',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'admin@campuskit.local',
    displayName: 'CampusKit Admin',
    role: 'admin',
    studentStatus: 'UNSUBMITTED',
    payoutProfile: null,
  },
];
