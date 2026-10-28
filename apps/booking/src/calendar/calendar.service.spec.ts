import { status } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { type DataSource, QueryFailedError } from 'typeorm';
import { CalendarService } from './calendar.service.js';

const listingId = '11111111-1111-4111-8111-111111111111';
const owner = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'student' as const,
};
const stranger = {
  sub: '00000000-0000-4000-8000-000000000002',
  role: 'student' as const,
};
const now = new Date('2026-10-28T05:00:00Z');
const blackout = {
  start: '2026-11-01T17:00:00Z',
  end: '2026-11-03T17:00:00Z',
};

function setup(ownerId = owner.sub) {
  const tx = {
    query: vi.fn((sql: string, _params?: unknown[]) =>
      Promise.resolve(
        sql.includes('SELECT owner_id') ? [{ owner_id: ownerId }] : [],
      ),
    ),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => Promise<void>) =>
      work(tx),
    ),
    query: vi.fn(),
  };
  const service = new CalendarService(db as unknown as DataSource);
  return { tx, db, service };
}

async function codeOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (err) {
    return ((err as RpcException).getError() as { code: number }).code;
  }
  return undefined;
}

describe('CalendarService.setupCalendar', () => {
  it('stores the caller as owner and replaces the blackouts', async () => {
    const { tx, service } = setup();
    await service.setupCalendar(owner, listingId, [blackout], now);
    const statements = tx.query.mock.calls.map(([sql]) => sql as string);
    expect(statements[0]).toContain('INSERT INTO calendars');
    expect(tx.query.mock.calls[0][1]).toEqual([listingId, owner.sub]);
    expect(
      statements.some((sql) => sql.includes('DELETE FROM calendar_blocks')),
    ).toBe(true);
    const inserts = tx.query.mock.calls.filter(([sql]) =>
      (sql as string).includes('INSERT INTO calendar_blocks'),
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual([
      listingId,
      new Date(blackout.start),
      new Date(blackout.end),
    ]);
  });

  it('refuses a caller who is not the calendar owner', async () => {
    const { tx, service } = setup(owner.sub);
    expect(
      await codeOf(service.setupCalendar(stranger, listingId, [], now)),
    ).toBe(status.PERMISSION_DENIED);
    expect(
      tx.query.mock.calls.some(([sql]) => (sql as string).includes('DELETE')),
    ).toBe(false);
  });

  it('answers ALREADY_EXISTS when a blackout overlaps a reservation', async () => {
    const { tx, service } = setup();
    tx.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner_id')) {
        return Promise.resolve([{ owner_id: owner.sub }]);
      }
      if (sql.includes('INSERT INTO calendar_blocks')) {
        return Promise.reject(
          new QueryFailedError(sql, [], { code: '23P01' } as unknown as Error),
        );
      }
      return Promise.resolve([]);
    });
    expect(
      await codeOf(service.setupCalendar(owner, listingId, [blackout], now)),
    ).toBe(status.ALREADY_EXISTS);
  });

  it('rejects invalid input before touching the database', async () => {
    const { db, service } = setup();
    expect(
      await codeOf(service.setupCalendar(owner, 'not-a-uuid', [], now)),
    ).toBe(status.INVALID_ARGUMENT);
    expect(
      await codeOf(
        service.setupCalendar(
          owner,
          listingId,
          [{ start: '2026-11-01T00:00:00Z', end: '2026-11-02T00:00:00Z' }],
          now,
        ),
      ),
    ).toBe(status.INVALID_ARGUMENT);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe('CalendarService.checkAvailability', () => {
  it('returns whether the period is free', async () => {
    const { db, service } = setup();
    db.query.mockResolvedValue([{ found: true, available: false }]);
    await expect(service.checkAvailability(listingId, blackout)).resolves.toBe(
      false,
    );
  });

  it('answers NOT_FOUND for a listing without a calendar', async () => {
    const { db, service } = setup();
    db.query.mockResolvedValue([{ found: false, available: true }]);
    expect(await codeOf(service.checkAvailability(listingId, blackout))).toBe(
      status.NOT_FOUND,
    );
  });

  it('rejects a missing or empty period', async () => {
    const { service } = setup();
    expect(await codeOf(service.checkAvailability(listingId, undefined))).toBe(
      status.INVALID_ARGUMENT,
    );
  });
});
