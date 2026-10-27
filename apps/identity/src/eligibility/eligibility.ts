import type { Account } from '../accounts/account.entity.js';

/** Why an account may not publish or book, in the order the rules are checked. */
export const ELIGIBILITY_REASONS = [
  'NOT_A_STUDENT',
  'ACCOUNT_SUSPENDED',
  'EMAIL_NOT_VERIFIED',
  'STUDENT_NOT_VERIFIED',
  'PAYOUT_PROFILE_MISSING',
] as const;

export type EligibilityReason = (typeof ELIGIBILITY_REASONS)[number];

/** Reasons that only block publishing; every other reason blocks both actions. */
const PUBLISH_ONLY: readonly EligibilityReason[] = ['PAYOUT_PROFILE_MISSING'];

export interface Eligibility {
  canPublish: boolean;
  canBook: boolean;
  reasons: EligibilityReason[];
}

type EligibilityFields = Pick<
  Account,
  'role' | 'suspendedAt' | 'emailVerifiedAt' | 'studentStatus' | 'payoutProfile'
>;

/**
 * Decides whether an account may publish a listing or request a booking.
 * Suspension is checked here because a token issued before the suspension stays valid until it expires.
 */
export function checkEligibility(account: EligibilityFields): Eligibility {
  const failing: Record<EligibilityReason, boolean> = {
    NOT_A_STUDENT: account.role !== 'student',
    ACCOUNT_SUSPENDED: account.suspendedAt !== null,
    EMAIL_NOT_VERIFIED: account.emailVerifiedAt === null,
    STUDENT_NOT_VERIFIED: account.studentStatus !== 'VERIFIED',
    PAYOUT_PROFILE_MISSING: account.payoutProfile === null,
  };
  const reasons = ELIGIBILITY_REASONS.filter((reason) => failing[reason]);
  return {
    canPublish: reasons.length === 0,
    canBook: reasons.every((reason) => PUBLISH_ONLY.includes(reason)),
    reasons,
  };
}
