import { currentCorrelationId } from '@app/common';
import type { DataSource } from 'typeorm';
import { rentalRow } from '../testing/fixtures.js';
import { RentalSweeper } from './rental-sweeper.js';

const now = new Date('2026-11-04T05:00:00Z');

function setup(reminded: unknown[] = [], overdue: unknown[] = []) {
  const correlationIds: (string | undefined)[] = [];
  const tx = {
    query: vi.fn((sql: string, _params: unknown[] = []) => {
      correlationIds.push(currentCorrelationId());
      if (sql.includes('SET reminder_sent_at')) {
        return Promise.resolve([reminded, reminded.length]);
      }
      if (sql.includes('SET overdue_at')) {
        return Promise.resolve([overdue, overdue.length]);
      }
      return Promise.resolve([]);
    }),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const sweeper = new RentalSweeper(db as unknown as DataSource);
  const statements = () => tx.query.mock.calls.map(([sql]) => sql);
  const events = () =>
    tx.query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse(params?.[2] as string));
  return { tx, db, sweeper, statements, events, correlationIds };
}

describe('RentalSweeper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reminds, then flags overdue rentals, in one transaction each', async () => {
    const { db, sweeper, statements } = setup();
    await sweeper.tick(now);
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(statements()[0]).toContain('SET reminder_sent_at');
    expect(statements()[1]).toContain('SET overdue_at');
  });

  it('reminds within RENTAL_REMINDER_LEAD_MS of the period end', async () => {
    vi.stubEnv('RENTAL_REMINDER_LEAD_MS', '120000');
    const { tx, sweeper } = setup();
    await sweeper.tick(now);
    expect(tx.query.mock.calls[0][1]).toEqual([
      now,
      new Date('2026-11-04T05:02:00Z'),
      50,
    ]);
  });

  it('writes each event in the transaction that changed the rental, under the sweep correlation ID', async () => {
    const { db, sweeper, events, correlationIds } = setup(
      [rentalRow({ id: 'a', status: 'ACTIVE' })],
      [rentalRow({ id: 'b', status: 'ACTIVE' })],
    );
    await sweeper.tick(now);
    expect(db.transaction).toHaveBeenCalledTimes(2);
    const [reminded, overdue] = events();
    expect(reminded).toMatchObject({
      type: 'rental.reminded',
      data: { rentalId: 'a' },
    });
    expect(overdue).toMatchObject({
      type: 'rental.overdue',
      data: { rentalId: 'b' },
    });
    expect(reminded.correlationId).toBe(overdue.correlationId);
    expect(new Set(correlationIds)).toEqual(new Set([reminded.correlationId]));
  });

  it('uses a new correlation ID for every sweep', async () => {
    const { sweeper, correlationIds } = setup();
    await sweeper.tick(now);
    await sweeper.tick(now);
    expect(new Set(correlationIds).size).toBe(2);
  });

  it('keeps running after a failed sweep and skips overlapping runs', async () => {
    const { db, sweeper } = setup();
    db.transaction.mockRejectedValueOnce(new Error('database down'));
    await expect(sweeper.tick(now)).resolves.toBeUndefined();
    expect(db.transaction).toHaveBeenCalledTimes(1);

    let finish: () => void = () => undefined;
    db.transaction.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve([]);
      }),
    );
    const first = sweeper.tick(now);
    await sweeper.tick(now);
    finish();
    await first;
    // The failed sweep stopped at its first transaction; the next one ran both.
    expect(db.transaction).toHaveBeenCalledTimes(3);
  });

  it('starts the timer once and stops it on shutdown', () => {
    vi.useFakeTimers();
    try {
      const { sweeper } = setup();
      const tick = vi.spyOn(sweeper, 'tick').mockResolvedValue();
      sweeper.onApplicationBootstrap();
      sweeper.onApplicationBootstrap();
      vi.advanceTimersByTime(60_000);
      expect(tick).toHaveBeenCalledTimes(1);
      sweeper.onModuleDestroy();
      vi.advanceTimersByTime(60_000);
      expect(tick).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
