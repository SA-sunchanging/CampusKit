import type { AuthUser } from '@app/common';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  type QueryDeepPartialEntity,
  Repository,
} from 'typeorm';
import { Account } from '../accounts/account.entity.js';
import { announceVerified } from '../events/identity-events.js';
import type { StudentQueueQuery } from './dto/student-queue.query.js';
import {
  type StudentQueueResponse,
  StudentReviewItemResponse,
} from './student-review-item.response.js';

/** Writes the event for a reviewed account, inside the review transaction. */
type Announce = (
  tx: EntityManager,
  account: Account,
  correlationId: string,
) => Promise<void>;

/** The administrator's review of the student IDs students submitted. */
@Injectable()
export class StudentReviewService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** One page of accounts in the given student status, oldest submission first. */
  async queue(query: StudentQueueQuery): Promise<StudentQueueResponse> {
    const [rows, total] = await this.accounts.findAndCount({
      where: { role: 'student', studentStatus: query.status },
      order: { studentSubmittedAt: 'ASC', createdAt: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      items: rows.map((row) => StudentReviewItemResponse.of(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** PENDING becomes VERIFIED; identity.verified goes to the student. */
  approve(
    admin: AuthUser,
    id: string,
    correlationId: string,
    now = new Date(),
  ): Promise<StudentReviewItemResponse> {
    return this.review(
      id,
      {
        studentStatus: 'VERIFIED',
        studentReviewedBy: admin.sub,
        studentReviewedAt: now,
      },
      correlationId,
      announceVerified,
    );
  }

  /** PENDING becomes REJECTED with the reason, which the student sees; no event. */
  reject(
    admin: AuthUser,
    id: string,
    reason: string,
    correlationId: string,
    now = new Date(),
  ): Promise<StudentReviewItemResponse> {
    return this.review(
      id,
      {
        studentStatus: 'REJECTED',
        studentRejectionReason: reason,
        studentReviewedBy: admin.sub,
        studentReviewedAt: now,
      },
      correlationId,
    );
  }

  /**
   * Changes a PENDING account once, even when two administrators act at the same time; only the
   * review that made the change writes its event, in the same transaction. Any other status
   * answers 409.
   */
  private review(
    id: string,
    change: QueryDeepPartialEntity<Account>,
    correlationId: string,
    announce?: Announce,
  ): Promise<StudentReviewItemResponse> {
    return this.db.transaction(async (tx) => {
      const repo = tx.getRepository(Account);
      const { affected } = await repo.update(
        { id, studentStatus: 'PENDING' },
        change,
      );
      const row = await repo.findOneBy({ id });
      if (!row) {
        throw new NotFoundException('Account not found');
      }
      if (affected !== 1) {
        throw new ConflictException(
          `Student status is ${row.studentStatus}, not waiting for review`,
        );
      }
      await announce?.(tx, row, correlationId);
      return StudentReviewItemResponse.of(row);
    });
  }
}
