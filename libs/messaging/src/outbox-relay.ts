import { correlationIdFrom, runWithCorrelationId } from '@app/common';
import type { EventEnvelope } from '@app/contracts';
import { BrokerUnavailableError, EventPublisher } from './event-publisher.js';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  metrics,
  type ObservableGauge,
  type ObservableResult,
} from '@opentelemetry/api';
import { DataSource, type EntityManager } from 'typeorm';

export const OUTBOX_POLL_INTERVAL_MS = 1_000;
export const OUTBOX_BATCH_SIZE = 50;

interface OutboxRow {
  id: string;
  envelope: EventEnvelope;
}

/** Unsent rows, read at each metrics scrape; a backlog that keeps growing means a silent failure. */
export const OUTBOX_PENDING_METRIC = 'campuskit.outbox.pending';

/**
 * Publishes unsent outbox_events to RabbitMQ, oldest first, and marks each one sent after the
 * broker confirms it, each under the event's correlation ID. Delivery is at least once:
 * Notification deduplicates on eventId.
 * Starts when the application has bootstrapped and stops when it shuts down. Reports the number
 * of unsent rows as the OUTBOX_PENDING_METRIC gauge.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private pendingGauge?: ObservableGauge;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly publisher: EventPublisher,
  ) {}

  onApplicationBootstrap(): void {
    this.start();
    this.pendingGauge = metrics
      .getMeter('@app/messaging')
      .createObservableGauge(OUTBOX_PENDING_METRIC, {
        description: 'Outbox events not yet confirmed by the broker',
      });
    this.pendingGauge.addCallback(this.observePending);
  }

  onModuleDestroy(): void {
    this.stop();
    this.pendingGauge?.removeCallback(this.observePending);
  }

  start(): void {
    this.timer ??= setInterval(() => void this.tick(), OUTBOX_POLL_INTERVAL_MS);
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
   * Publishes up to OUTBOX_BATCH_SIZE events. Stops at the first publish failure and keeps the
   * marks already made; the failed event is retried on the next run. Returns how many were sent.
   */
  relayBatch(): Promise<number> {
    return this.db.transaction(async (tx) => {
      // SKIP LOCKED lets a second instance of the service take other rows instead of waiting.
      const rows = (await tx.query(
        `SELECT id, envelope FROM outbox_events
         WHERE sent_at IS NULL
         ORDER BY created_at, id
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [OUTBOX_BATCH_SIZE],
      )) as OutboxRow[];
      let sent = 0;
      for (const row of rows) {
        // Log lines about an event carry the correlation ID of the request that caused it.
        const id = correlationIdFrom(row.envelope.correlationId);
        if (!(await runWithCorrelationId(id, () => this.publishOne(tx, row)))) {
          break;
        }
        sent++;
      }
      return sent;
    });
  }

  /** Reports the unsent rows; skips the point when the database does not answer. */
  private readonly observePending = async (
    result: ObservableResult,
  ): Promise<void> => {
    try {
      const [{ pending }] = (await this.db.query(
        `SELECT count(*)::int AS pending FROM outbox_events WHERE sent_at IS NULL`,
      )) as { pending: number }[];
      result.observe(pending);
    } catch (err) {
      this.logger.warn(`Counting unsent outbox events failed: ${String(err)}`);
    }
  };

  private async publishOne(
    tx: EntityManager,
    row: OutboxRow,
  ): Promise<boolean> {
    try {
      await this.publisher.publish(row.envelope);
    } catch (err) {
      // The publisher logs a broker outage once; logging it here would repeat it every poll.
      if (!(err instanceof BrokerUnavailableError)) {
        this.logger.warn(`Publishing event ${row.id} failed: ${String(err)}`);
      }
      return false;
    }
    await tx.query(`UPDATE outbox_events SET sent_at = now() WHERE id = $1`, [
      row.id,
    ]);
    return true;
  }
}
