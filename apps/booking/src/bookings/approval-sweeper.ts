import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  Compensation,
  failStartedApprovals,
  SWEEP_BATCH,
} from './compensation.js';
import { expireStale, staleBatch } from './expiry.js';

export const SWEEP_INTERVAL_MS = 60_000;

/**
 * Ends bookings that can no longer go ahead, so they do not hold dates or money: every minute
 * it expires PENDING requests the owner did not answer in time and fails AUTHORIZING bookings
 * whose period has started (releasing their dates and telling both people), then asks Payment
 * again to void the holds of FAILED bookings whose void has not succeeded yet.
 * Starts when the application has bootstrapped and stops when it shuts down.
 */
@Injectable()
export class ApprovalSweeper
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ApprovalSweeper.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly compensation: Compensation,
  ) {}

  onApplicationBootstrap(): void {
    this.timer ??= setInterval(() => void this.tick(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One sweep; skipped while the previous one is still busy. Never throws. */
  async tick(now = new Date()): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.sweep(now);
    } catch (err) {
      this.logger.error(`Approval sweep failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  /** Expires unanswered requests, fails the started approvals, then retries each pending void once. */
  async sweep(now: Date): Promise<void> {
    const call = { correlationId: randomUUID() };
    const expired = await this.db.transaction((tx) =>
      expireStale(tx, staleBatch(SWEEP_BATCH), now, call.correlationId),
    );
    if (expired.length > 0) {
      this.logger.log(
        `Expired ${expired.length} unanswered requests (correlation ${call.correlationId})`,
      );
    }
    const failed = await this.db.transaction((tx) =>
      failStartedApprovals(tx, now, call.correlationId),
    );
    if (failed.length > 0) {
      this.logger.log(
        `Failed ${failed.length} approvals whose period started (correlation ${call.correlationId})`,
      );
    }
    for (const id of await this.compensation.unvoided()) {
      await this.compensation.voidHolds(id, call);
    }
  }
}
