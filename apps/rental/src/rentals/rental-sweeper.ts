import { runWithCorrelationId } from '@app/common';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { flagOverdue, remindEnding } from './overdue.js';
import { reminderLeadMs, sweepIntervalMs } from './sweep-config.js';

/**
 * Watches the ACTIVE rentals on a schedule: every RENTAL_SWEEP_INTERVAL_MS it reminds the renter
 * when the period ends within RENTAL_REMINDER_LEAD_MS, and flags a rental overdue (telling both
 * people) once its period has ended before the return. Each sweep runs under its own correlation
 * ID. Starts when the application has bootstrapped and stops when it shuts down.
 */
@Injectable()
export class RentalSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RentalSweeper.name);
  private readonly intervalMs = sweepIntervalMs();
  private readonly leadMs = reminderLeadMs();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  onApplicationBootstrap(): void {
    this.timer ??= setInterval(() => void this.tick(), this.intervalMs);
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
      this.logger.error(`Rental sweep failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  /** Reminds a batch of renters, then flags a batch of overdue rentals, one transaction each. */
  sweep(now: Date): Promise<void> {
    const correlationId = randomUUID();
    return runWithCorrelationId(correlationId, async () => {
      const reminded = await this.db.transaction((tx) =>
        remindEnding(tx, now, this.leadMs, correlationId),
      );
      if (reminded.length > 0) {
        this.logger.log(
          `Reminded the renters of ${reminded.length} rentals ending soon`,
        );
      }
      const overdue = await this.db.transaction((tx) =>
        flagOverdue(tx, now, correlationId),
      );
      if (overdue.length > 0) {
        this.logger.log(`Flagged ${overdue.length} rentals overdue`);
      }
    });
  }
}
