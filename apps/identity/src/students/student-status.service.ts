import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Account, type StudentStatus } from '../accounts/account.entity.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { type Profile, toProfile } from '../accounts/profile.js';

/** A student may submit a student ID from these statuses only. */
export const SUBMITTABLE: readonly StudentStatus[] = [
  'UNSUBMITTED',
  'REJECTED',
];

/** The student's side of student verification: submitting a student ID for review. */
@Injectable()
export class StudentStatusService {
  constructor(
    private readonly accounts: AccountsService,
    @InjectRepository(Account) private readonly repo: Repository<Account>,
  ) {}

  /**
   * UNSUBMITTED or REJECTED becomes PENDING with the student ID; a resubmission clears the earlier
   * review. Needs a verified email (409 otherwise) and a student account (403). The update is
   * conditional, so a status that changed meanwhile answers 409.
   */
  async submit(
    accountId: string,
    studentId: string,
    now = new Date(),
  ): Promise<Profile> {
    const account = await this.accounts.getAccount(accountId);
    if (account.role !== 'student') {
      throw new ForbiddenException('Only students have a student status');
    }
    if (account.emailVerifiedAt === null) {
      throw new ConflictException(
        'Verify your email before submitting your student ID',
      );
    }
    if (!SUBMITTABLE.includes(account.studentStatus)) {
      throw new ConflictException(
        `Student status is ${account.studentStatus}, so it cannot be submitted`,
      );
    }
    const change = {
      studentStatus: 'PENDING' as const,
      studentId,
      studentSubmittedAt: now,
      studentReviewedBy: null,
      studentReviewedAt: null,
      studentRejectionReason: null,
    };
    const { affected } = await this.repo.update(
      { id: accountId, studentStatus: In(SUBMITTABLE) },
      change,
    );
    if (affected !== 1) {
      throw new ConflictException('Student status changed; reload and retry');
    }
    return toProfile(Object.assign(account, change));
  }
}
