import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { Account } from '../accounts/account.entity.js';
import { checkEligibility } from '../eligibility/eligibility.js';
import { StudentReviewService } from './student-review.service.js';

const admin = {
  sub: '00000000-0000-4000-8000-000000000003',
  role: 'admin' as const,
};
const id = '11111111-1111-4111-8111-111111111111';
const correlationId = 'corr-1';
const now = new Date('2026-10-29T05:00:00Z');
const submittedAt = new Date('2026-10-28T09:00:00Z');

const pending = (): Partial<Account> => ({
  id,
  email: 'new@student.chula.ac.th',
  displayName: 'New Student',
  role: 'student',
  emailVerifiedAt: new Date('2026-10-28T08:00:00Z'),
  studentStatus: 'PENDING',
  studentId: '6630012321',
  studentSubmittedAt: submittedAt,
  studentReviewedBy: null,
  studentReviewedAt: null,
  studentRejectionReason: null,
  payoutProfile: {
    method: 'PROMPTPAY',
    promptPayId: '0812345678',
    accountName: 'New Student',
  },
  suspendedAt: null,
  createdAt: new Date('2026-10-28T07:00:00Z'),
});

function setup(initial: Partial<Account> | null = pending()) {
  let stored = initial ? { ...initial } : undefined;
  const repo = {
    findAndCount: vi.fn().mockResolvedValue([[pending()], 3]),
    findOneBy: vi.fn(() => Promise.resolve(stored ? { ...stored } : null)),
    update: vi.fn((where: Partial<Account>, fields: Partial<Account>) => {
      const match = stored?.studentStatus === where.studentStatus;
      if (stored && match) {
        stored = { ...stored, ...fields };
      }
      return Promise.resolve({ affected: match ? 1 : 0 });
    }),
  };
  const tx = {
    getRepository: vi.fn(() => repo),
    query: vi.fn().mockResolvedValue([]),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => unknown) => work(tx)),
  };
  const service = new StudentReviewService(
    repo as unknown as Repository<Account>,
    db as unknown as DataSource,
  );
  /** The envelopes written to the outbox, in order. */
  const events = () =>
    tx.query.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse((params as string[])[2]) as unknown);
  return { service, repo, db, events, stored: () => stored };
}

describe('StudentReviewService.queue', () => {
  it('returns one page of students in the status, oldest submission first', async () => {
    const { service, repo } = setup();
    const result = await service.queue({
      status: 'PENDING',
      page: 2,
      pageSize: 10,
    });
    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: { role: 'student', studentStatus: 'PENDING' },
      order: { studentSubmittedAt: 'ASC', createdAt: 'ASC', id: 'ASC' },
      skip: 10,
      take: 10,
    });
    expect(result).toMatchObject({ total: 3, page: 2, pageSize: 10 });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id,
        email: 'new@student.chula.ac.th',
        displayName: 'New Student',
        studentId: '6630012321',
        submittedAt,
      }),
    );
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });
});

describe('StudentReviewService.approve', () => {
  it('verifies the student and records the reviewer', async () => {
    const { service, repo } = setup();
    const result = await service.approve(admin, id, correlationId, now);
    expect(repo.update).toHaveBeenCalledWith(
      { id, studentStatus: 'PENDING' },
      {
        studentStatus: 'VERIFIED',
        studentReviewedBy: admin.sub,
        studentReviewedAt: now,
      },
    );
    expect(result).toMatchObject({
      studentStatus: 'VERIFIED',
      reviewedAt: now,
    });
  });

  it('writes identity.verified to the student in the same transaction', async () => {
    const { service, db, events } = setup();
    await service.approve(admin, id, correlationId, now);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'identity.verified',
        producer: 'identity',
        recipients: [id],
        correlationId,
        data: { userId: id, studentStatus: 'VERIFIED' },
      }),
    ]);
  });

  it('makes a student with a payout profile eligible to publish and book', async () => {
    const { service, stored } = setup();
    await service.approve(admin, id, correlationId, now);
    expect(checkEligibility(stored() as Account)).toEqual({
      canPublish: true,
      canBook: true,
      reasons: [],
    });
  });

  it.each(['UNSUBMITTED', 'VERIFIED', 'REJECTED'] as const)(
    'answers 409 for a %s student and writes no event',
    async (studentStatus) => {
      const { service, events } = setup({ ...pending(), studentStatus });
      await expect(
        service.approve(admin, id, correlationId, now),
      ).rejects.toThrow(ConflictException);
      expect(events()).toEqual([]);
    },
  );

  it('answers 404 for an unknown account', async () => {
    const { service } = setup(null);
    await expect(
      service.approve(admin, id, correlationId, now),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('StudentReviewService.reject', () => {
  it('rejects with the reason, records the reviewer, and writes no event', async () => {
    const { service, repo, events } = setup();
    const result = await service.reject(
      admin,
      id,
      'Not enrolled this term',
      correlationId,
      now,
    );
    expect(repo.update).toHaveBeenCalledWith(
      { id, studentStatus: 'PENDING' },
      {
        studentStatus: 'REJECTED',
        studentRejectionReason: 'Not enrolled this term',
        studentReviewedBy: admin.sub,
        studentReviewedAt: now,
      },
    );
    expect(result).toMatchObject({
      studentStatus: 'REJECTED',
      rejectionReason: 'Not enrolled this term',
    });
    expect(events()).toEqual([]);
  });

  it('lets only the first of two reviews change the status', async () => {
    const { service, events } = setup();
    await service.approve(admin, id, correlationId, now);
    await expect(
      service.reject(admin, id, 'Too late', correlationId, now),
    ).rejects.toThrow(ConflictException);
    expect(events()).toHaveLength(1);
  });
});
