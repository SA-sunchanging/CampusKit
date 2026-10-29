import type { DataSource } from 'typeorm';
import { ApprovalSweeper } from './approval-sweeper.js';
import type { Compensation } from './compensation.js';

const now = new Date('2026-11-01T17:00:00Z');

function setup(failedRows: unknown[] = []) {
  const tx = {
    query: vi.fn((sql: string, _params: unknown[] = []) =>
      Promise.resolve(
        sql.includes("SET status = 'FAILED'")
          ? [failedRows, failedRows.length]
          : [],
      ),
    ),
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
  return { tx, db, compensation, sweeper };
}

describe('ApprovalSweeper', () => {
  it('fails started approvals before it retries the voids', async () => {
    const { tx, compensation, sweeper } = setup();
    await sweeper.tick(now);
    const [sql, params] = tx.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'AUTHORIZING' AND lower(period) <= $1");
    expect(params[0]).toBe(now);
    expect(compensation.voidHolds.mock.calls.map(([id]) => id)).toEqual([
      'b1',
      'b2',
    ]);
  });

  it('releases the dates and announces each failed booking', async () => {
    const failed = {
      id: 'b3',
      listing_id: 'l1',
      owner_id: 'o1',
      renter_id: 'r1',
      status: 'FAILED',
      period_start: now,
      period_end: new Date('2026-11-02T17:00:00Z'),
    };
    const { tx, sweeper } = setup([failed]);
    await sweeper.tick(now);
    const statements = tx.query.mock.calls.map(([sql]) => sql);
    expect(statements[1]).toContain('UPDATE calendar_blocks');
    expect(tx.query.mock.calls[1][1]).toEqual([['b3']]);
    expect(statements[2]).toContain('INSERT INTO outbox_events');
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
    expect(db.transaction).toHaveBeenCalledTimes(2);
  });
});
