import type { EventEnvelope } from '@app/contracts';
import { EventPublisher } from '@app/messaging';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

export const POLL_INTERVAL_MS = 1_000;
export const BATCH_SIZE = 50;

interface OutboxRow {
  id: string;
  envelope: EventEnvelope;
}

/**
 * Publishes unsent outbox_events to RabbitMQ, oldest first, and marks each one sent after the
 * broker confirms it. Delivery is at least once: Notification deduplicates on eventId.
 * Starts when the application has bootstrapped and stops when it shuts down.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly publisher: EventPublisher,
  ) {}

  onApplicationBootstrap(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    this.timer ??= setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One polling run; skipped while the previous run is still busy. Never throws. */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.relayBatch();
    } catch (err) {
      this.logger.error(`Outbox relay run failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Publishes up to BATCH_SIZE events. Stops at the first publish failure and keeps the marks
   * already made; the failed event is retried on the next run. Returns how many were sent.
   */
  relayBatch(): Promise<number> {
    return this.db.transaction(async (tx) => {
      // SKIP LOCKED lets a second Booking instance take other rows instead of waiting.
      const rows = (await tx.query(
        `SELECT id, envelope FROM outbox_events
         WHERE sent_at IS NULL
         ORDER BY created_at, id
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [BATCH_SIZE],
      )) as OutboxRow[];
      let sent = 0;
      for (const row of rows) {
        if (!(await this.publishOne(tx, row))) {
          break;
        }
        sent++;
      }
      return sent;
    });
  }

  private async publishOne(
    tx: EntityManager,
    row: OutboxRow,
  ): Promise<boolean> {
    try {
      await this.publisher.publish(row.envelope);
    } catch (err) {
      this.logger.warn(`Publishing event ${row.id} failed: ${String(err)}`);
      return false;
    }
    await tx.query(`UPDATE outbox_events SET sent_at = now() WHERE id = $1`, [
      row.id,
    ]);
    return true;
  }
}
