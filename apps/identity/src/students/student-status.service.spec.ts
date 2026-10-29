import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { type FindOperator, type Repository } from 'typeorm';
import type { Account, StudentStatus } from '../accounts/account.entity.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import { checkEligibility } from '../eligibility/eligibility.js';
import { StudentStatusService } from './student-status.service.js';

const accountId = '00000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-29T05:00:00Z');

// A plain row rather than a class instance, so the mocks can copy it with a spread.
type AccountRow = Pick<Account, keyof Account>;

const account = (fields: Partial<Account> = {}): AccountRow => ({
  id: accountId,
  email: 'somchai@student.chula.ac.th',
  passwordHash: 'scrypt$hash',
  displayName: 'Somchai',
  role: 'student',
  emailVerifiedAt: new Date('2026-10-28T00:00:00Z'),
  studentStatus: 'UNSUBMITTED',
  studentId: null,
  studentSubmittedAt: null,
  studentReviewedBy: null,
  studentReviewedAt: null,
  studentRejectionReason: null,
  payoutProfile: null,
  suspendedAt: null,
  createdAt: new Date('2026-10-26T00:00:00Z'),
  ...fields,
});

interface UpdateWhere {
  id: string;
  studentStatus: FindOperator<StudentStatus[]>;
}

function setup(initial: AccountRow | null = account()) {
  let stored = initial ? { ...initial } : null;
  const accounts = {
    getAccount: vi.fn(() =>
      stored
        ? Promise.resolve({ ...stored })
        : Promise.reject(new NotFoundException('Account not found')),
    ),
  };
  const repo = {
    // Applies the conditional update the way PostgreSQL would.
    update: vi.fn((where: UpdateWhere, fields: Partial<Account>) => {
      const match =
        stored !== null &&
        where.studentStatus.value.includes(stored.studentStatus);
      if (stored && match) {
        stored = { ...stored, ...fields };
      }
      return Promise.resolve({ affected: match ? 1 : 0 });
    }),
  };
  const service = new StudentStatusService(
    accounts as unknown as AccountsService,
    repo as unknown as Repository<Account>,
  );
  return { service, repo, stored: () => stored };
}

describe('StudentStatusService.submit', () => {
  it('moves an UNSUBMITTED student to PENDING with the student ID', async () => {
    const { service, stored } = setup();
    const profile = await service.submit(accountId, '6630012321', now);
    expect(profile).toMatchObject({
      studentStatus: 'PENDING',
      studentId: '6630012321',
      studentRejectionReason: null,
    });
    expect(stored()).toMatchObject({
      studentStatus: 'PENDING',
      studentId: '6630012321',
      studentSubmittedAt: now,
    });
  });

  it('lets a REJECTED student submit again and clears the earlier review', async () => {
    const { service, stored } = setup(
      account({
        studentStatus: 'REJECTED',
        studentId: '6630000000',
        studentRejectionReason: 'Not enrolled',
        studentReviewedBy: '00000000-0000-4000-8000-000000000003',
        studentReviewedAt: now,
      }),
    );
    await service.submit(accountId, '6630012321', now);
    expect(stored()).toMatchObject({
      studentStatus: 'PENDING',
      studentId: '6630012321',
      studentRejectionReason: null,
      studentReviewedBy: null,
      studentReviewedAt: null,
    });
  });

  it.each(['PENDING', 'VERIFIED'] as const)(
    'answers 409 for a %s student and changes nothing',
    async (studentStatus) => {
      const { service, repo } = setup(account({ studentStatus }));
      await expect(
        service.submit(accountId, '6630012321', now),
      ).rejects.toThrow(ConflictException);
      expect(repo.update).not.toHaveBeenCalled();
    },
  );

  it('answers 409 until the email is verified', async () => {
    const { service, repo } = setup(account({ emailVerifiedAt: null }));
    await expect(service.submit(accountId, '6630012321', now)).rejects.toThrow(
      'Verify your email before submitting your student ID',
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('refuses an administrator with 403', async () => {
    const { service } = setup(account({ role: 'admin' }));
    await expect(service.submit(accountId, '6630012321', now)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('answers 409 when the status changed between the read and the update', async () => {
    const { service, repo } = setup();
    repo.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.submit(accountId, '6630012321', now)).rejects.toThrow(
      'Student status changed; reload and retry',
    );
  });

  it('answers 404 for an unknown account', async () => {
    const { service } = setup(null);
    await expect(service.submit(accountId, '6630012321', now)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('keeps a PENDING student from publishing or booking', async () => {
    const { service, stored } = setup();
    await service.submit(accountId, '6630012321', now);
    expect(checkEligibility(stored() as Account).reasons).toContain(
      'STUDENT_NOT_VERIFIED',
    );
  });
});
