import type { StudentStatus } from '../accounts/account.entity.js';
import { checkEligibility } from './eligibility.js';

const eligible = {
  role: 'student' as const,
  suspendedAt: null,
  emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
  studentStatus: 'VERIFIED' as StudentStatus,
  payoutProfile: {
    method: 'PROMPTPAY' as const,
    promptPayId: '0812345678',
    accountName: 'Somchai Jaidee',
  },
};

describe('checkEligibility', () => {
  it('lets a verified student with a payout profile publish and book', () => {
    expect(checkEligibility(eligible)).toEqual({
      canPublish: true,
      canBook: true,
      reasons: [],
    });
  });

  it('blocks both actions for an administrator', () => {
    expect(checkEligibility({ ...eligible, role: 'admin' })).toEqual({
      canPublish: false,
      canBook: false,
      reasons: ['NOT_A_STUDENT'],
    });
  });

  it('blocks both actions for a suspended account', () => {
    expect(checkEligibility({ ...eligible, suspendedAt: new Date() })).toEqual({
      canPublish: false,
      canBook: false,
      reasons: ['ACCOUNT_SUSPENDED'],
    });
  });

  it('blocks both actions when the email is not verified', () => {
    expect(checkEligibility({ ...eligible, emailVerifiedAt: null })).toEqual({
      canPublish: false,
      canBook: false,
      reasons: ['EMAIL_NOT_VERIFIED'],
    });
  });

  it.each<StudentStatus>(['UNSUBMITTED', 'PENDING', 'REJECTED'])(
    'blocks both actions when the student status is %s',
    (studentStatus) => {
      expect(checkEligibility({ ...eligible, studentStatus })).toEqual({
        canPublish: false,
        canBook: false,
        reasons: ['STUDENT_NOT_VERIFIED'],
      });
    },
  );

  it('still allows booking without a payout profile', () => {
    expect(checkEligibility({ ...eligible, payoutProfile: null })).toEqual({
      canPublish: false,
      canBook: true,
      reasons: ['PAYOUT_PROFILE_MISSING'],
    });
  });

  it('lists every failing rule in a fixed order', () => {
    expect(
      checkEligibility({
        role: 'admin',
        suspendedAt: new Date(),
        emailVerifiedAt: null,
        studentStatus: 'PENDING',
        payoutProfile: null,
      }),
    ).toEqual({
      canPublish: false,
      canBook: false,
      reasons: [
        'NOT_A_STUDENT',
        'ACCOUNT_SUSPENDED',
        'EMAIL_NOT_VERIFIED',
        'STUDENT_NOT_VERIFIED',
        'PAYOUT_PROFILE_MISSING',
      ],
    });
  });

  it('blocks booking when a publish-only reason comes with another one', () => {
    expect(
      checkEligibility({
        ...eligible,
        emailVerifiedAt: null,
        payoutProfile: null,
      }),
    ).toMatchObject({
      canBook: false,
      reasons: ['EMAIL_NOT_VERIFIED', 'PAYOUT_PROFILE_MISSING'],
    });
  });
});
