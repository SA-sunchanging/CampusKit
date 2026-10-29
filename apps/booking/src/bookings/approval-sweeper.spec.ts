import type { DataSource } from 'typeorm';
import { ApprovalSweeper } from './approval-sweeper.js';
import type { Compensation } from './compensation.js';

const now = new Date('2026-11-01T17:00:00Z');

function bookingRow(id: string, status: string) {
  return {
    id,
    listing_id: 'l1',
    owner_id: 'o1',
    renter_id: 'r1',
    status,
    period_start: now,
    period_end: new Date('2026-11-02T17:00:00Z'),
  };
}

function setup(failedRows: unknown[] = [], expiredRows: unknown[] = []) {
  const tx = {
    query: vi.fn((sql: string, _params: unknown[] = []) => {
      if (sql.includes('WITH expired')) {
        return Promise.resolve(expiredRows);
      }
      return Promise.resolve(
        sql.includes("SET status = 'FAILED'")
          ? [failedRows, failedRows.length]
          : [],
      );
    }),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const compensation = {
    unvoided: vi.fn().mockResolvedValue(['b1', 'b2']),
    voidHolds: vi.fn().mockResolvedValue(true),
  };
  const sweeper = new ApprovalSweeper(
    db as unknown as DataSource,
    compensation as unknown as Compensation,
  );
  const statements = () => tx.query.mock.calls.map(([sql]) => sql);
  const events = () =>
    tx.query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse(params?.[2] as string));
  return { tx, db, compensation, sweeper, statements, events };
}

describe('ApprovalSweeper', () => {
  it('expires requests and fails started approvals before it retries the voids', async () => {
    const { tx, compensation, sweeper, statements } = setup();
    await sweeper.tick(now);
    expect(statements()[0]).toContain('WITH expired');
    const [sql, params] = tx.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("status = 'AUTHORIZING' AND lower(period) <= $1");
    expect(params[0]).toBe(now);
    expect(compensation.voidHolds.mock.calls.map(([id]) => id)).toEqual([
      'b1',
      'b2',
    ]);
  });

  it('expires a batch of stale requests, skipping locked ones, and releases their dates', async () => {
    const { tx, sweeper } = setup();
    await sweeper.tick(now);
    const [sql, params] = tx.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE status = 'PENDING' AND expires_at <= $1");
    expect(sql).toContain('LIMIT $2');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('UPDATE calendar_blocks SET released_at = now()');
    expect(params).toEqual([now, 50]);
  });

  it('announces each expired request once, to the owner and the renter', async () => {
    const { sweeper, events } = setup(
      [],
      [bookingRow('b4', 'EXPIRED'), bookingRow('b5', 'EXPIRED')],
    );
    await sweeper.tick(now);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'booking.expired',
        recipients: ['o1', 'r1'],
        data: expect.objectContaining({ bookingId: 'b4', status: 'EXPIRED' }),
      }),
      expect.objectContaining({
        type: 'booking.expired',
        data: expect.objectContaining({ bookingId: 'b5' }),
      }),
    ]);
  });

  it('announces nothing when no request expired', async () => {
    const { sweeper, events } = setup();
    await sweeper.tick(now);
    expect(events()).toEqual([]);
  });

  it('releases the dates and announces each failed booking', async () => {
    const { tx, sweeper, statements } = setup([bookingRow('b3', 'FAILED')]);
    await sweeper.tick(now);
    expect(statements()[2]).toContain('UPDATE calendar_blocks');
    expect(tx.query.mock.calls[2][1]).toEqual([['b3']]);
    expect(statements()[3]).toContain('INSERT INTO outbox_events');
  });

  it('keeps running after a failed sweep and skips overlapping runs', async () => {
    const { db, compensation, sweeper } = setup();
    db.transaction.mockRejectedValueOnce(new Error('database down'));
    await expect(sweeper.tick(now)).resolves.toBeUndefined();
    expect(compensation.unvoided).not.toHaveBeenCalled();

    let finish: () => void = () => undefined;
    compensation.unvoided.mockReturnValueOnce(
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
});
