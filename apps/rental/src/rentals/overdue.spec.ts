import type { EntityManager } from 'typeorm';
import { OWNER_ID, RENTER_ID, rentalRow } from '../testing/fixtures.js';
import { flagOverdue, remindEnding } from './overdue.js';
import type { RentalRow } from './rental.row.js';

const now = new Date('2026-11-04T05:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** A transaction whose UPDATE returns rows; it records every statement. */
function transaction(rows: RentalRow[]) {
  const query = vi.fn((sql: string, _params: unknown[] = []) =>
    Promise.resolve(sql.startsWith('UPDATE') ? [rows, rows.length] : []),
  );
  const tx = { query } as unknown as EntityManager;
  const update = () => query.mock.calls[0] as [string, unknown[]];
  const events = () =>
    query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse(params?.[2] as string));
  return { tx, query, update, events };
}

describe('remindEnding', () => {
  it('reminds a batch of ACTIVE rentals ending within the lead, skipping locked ones', async () => {
    const { tx, update } = transaction([]);
    await remindEnding(tx, now, DAY, 'corr-1');
    const [sql, params] = update();
    expect(sql).toContain('SET reminder_sent_at = $1');
    expect(sql).toContain("status = 'ACTIVE' AND reminder_sent_at IS NULL");
    expect(sql).toContain('period_end > $1 AND period_end <= $2');
    expect(sql).toContain('LIMIT $3');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(params).toEqual([now, new Date('2026-11-05T05:00:00Z'), 50]);
  });

  it('checks the condition again on the locked row, so only one statement changes it', async () => {
    const { tx, update } = transaction([]);
    await remindEnding(tx, now, DAY, 'corr-1');
    const [sql] = update();
    const outer = sql.slice(0, sql.indexOf('id IN ('));
    expect(outer).toContain("status = 'ACTIVE' AND reminder_sent_at IS NULL");
    expect(outer).toContain('period_end > $1');
  });

  it('writes rental.reminded to the renter only, in the same transaction', async () => {
    const row = rentalRow({ status: 'ACTIVE', reminder_sent_at: now });
    const { tx, query, events } = transaction([row]);
    await expect(remindEnding(tx, now, DAY, 'corr-1')).resolves.toEqual([row]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'rental.reminded',
        recipients: [RENTER_ID],
        correlationId: 'corr-1',
        data: expect.objectContaining({ status: 'ACTIVE', lateFee: 0 }),
      }),
    ]);
  });

  it('announces nothing when no rental is due', async () => {
    const { tx, events } = transaction([]);
    await expect(remindEnding(tx, now, DAY, 'corr-1')).resolves.toEqual([]);
    expect(events()).toEqual([]);
  });
});

describe('flagOverdue', () => {
  it('flags a batch of ACTIVE rentals whose period ended, skipping locked ones', async () => {
    const { tx, update } = transaction([]);
    await flagOverdue(tx, now, 'corr-1');
    const [sql, params] = update();
    expect(sql).toContain('SET overdue_at = $1');
    expect(sql).toContain(
      "status = 'ACTIVE' AND overdue_at IS NULL AND period_end <= $1",
    );
    expect(sql).not.toContain('reminder_sent_at = ');
    expect(sql).toContain('LIMIT $2');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(params).toEqual([now, 50]);
  });

  it('writes rental.overdue to the owner and the renter for each flagged rental', async () => {
    const rows = [
      rentalRow({ id: 'a', status: 'ACTIVE', overdue_at: now }),
      rentalRow({ id: 'b', status: 'ACTIVE', overdue_at: now }),
    ];
    const { tx, events } = transaction(rows);
    await expect(flagOverdue(tx, now, 'corr-2')).resolves.toEqual(rows);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'rental.overdue',
        recipients: [OWNER_ID, RENTER_ID],
        correlationId: 'corr-2',
        data: expect.objectContaining({ rentalId: 'a', status: 'ACTIVE' }),
      }),
      expect.objectContaining({
        type: 'rental.overdue',
        data: expect.objectContaining({ rentalId: 'b' }),
      }),
    ]);
  });
});
