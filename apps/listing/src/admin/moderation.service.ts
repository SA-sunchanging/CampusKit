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
import type { CallContext } from '../clients/call-context.js';
import {
  announcePublished,
  announceRejected,
} from '../listings/listing-events.js';
import { Listing } from '../listings/listing.entity.js';
import type { ReviewQueueQuery } from './dto/review-queue.query.js';
import {
  ReviewItemResponse,
  type ReviewQueueResponse,
} from './review-item.response.js';

/** Writes the event for a reviewed listing, inside the review transaction. */
type Announce = (
  tx: EntityManager,
  listing: Listing,
  correlationId: string,
) => Promise<void>;

/** The administrator's review of listings the moderation rule held back. */
@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** One page of listings in the given status, oldest first, so none waits forever. */
  async queue(query: ReviewQueueQuery): Promise<ReviewQueueResponse> {
    const [rows, total] = await this.listings.findAndCount({
      where: { status: query.status },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      items: rows.map((row) => ReviewItemResponse.of(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** PENDING_REVIEW becomes PUBLISHED and searchable; listing.published goes to the owner. */
  approve(
    admin: AuthUser,
    id: string,
    call: CallContext,
    now = new Date(),
  ): Promise<ReviewItemResponse> {
    return this.review(
      id,
      {
        status: 'PUBLISHED',
        publishedAt: now,
        reviewedBy: admin.sub,
        reviewedAt: now,
      },
      announcePublished,
      call,
    );
  }

  /** PENDING_REVIEW becomes REJECTED; listing.rejected with the reason goes to the owner. */
  reject(
    admin: AuthUser,
    id: string,
    reason: string,
    call: CallContext,
    now = new Date(),
  ): Promise<ReviewItemResponse> {
    return this.review(
      id,
      {
        status: 'REJECTED',
        rejectionReason: reason,
        reviewedBy: admin.sub,
        reviewedAt: now,
      },
      announceRejected,
      call,
    );
  }

  /**
   * Changes a PENDING_REVIEW listing once, even when two administrators act at the same time;
   * only the review that made the change writes the event, in the same transaction. Any other
   * status answers 409.
   */
  private review(
    id: string,
    change: QueryDeepPartialEntity<Listing>,
    announce: Announce,
    call: CallContext,
  ): Promise<ReviewItemResponse> {
    return this.db.transaction(async (tx) => {
      const repo = tx.getRepository(Listing);
      const { affected } = await repo.update(
        { id, status: 'PENDING_REVIEW' },
        change,
      );
      const row = await repo.findOneBy({ id });
      if (!row) {
        throw new NotFoundException('Listing not found');
      }
      if (affected !== 1) {
        throw new ConflictException(
          `Listing is ${row.status}, not waiting for review`,
        );
      }
      await announce(tx, row, call.correlationId);
      return ReviewItemResponse.of(row);
    });
  }
}
