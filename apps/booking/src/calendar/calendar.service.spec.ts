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

describe('CalendarService.filterAvailable', () => {
  const other = '33333333-3333-4333-8333-333333333333';
  const third = '44444444-4444-4444-8444-444444444444';

  it('returns the free listings in the given order with one query', async () => {
    const { db, service } = setup();
    db.query.mockResolvedValue([
      { listing_id: listingId },
      { listing_id: third },
    ]);
    await expect(
      service.filterAvailable([third, other, listingId], blackout),
    ).resolves.toEqual([third, listingId]);
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('released_at IS NULL');
    expect(sql).toContain("period && tstzrange($2, $3, '[)')");
    expect(params).toEqual([
      [third, other, listingId],
      new Date(blackout.start),
      new Date(blackout.end),
    ]);
  });

  it('matches IDs sent in upper case', async () => {
    const { db, service } = setup();
    db.query.mockResolvedValue([{ listing_id: listingId }]);
    const upper = listingId.toUpperCase();
    await expect(service.filterAvailable([upper], blackout)).resolves.toEqual([
      upper,
    ]);
  });

  it('answers an empty list without a query', async () => {
    const { db, service } = setup();
    await expect(service.filterAvailable([], blackout)).resolves.toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects more than 200 IDs, a bad ID, or a bad period', async () => {
    const { db, service } = setup();
    const many = Array.from({ length: 201 }, () => listingId);
    expect(await codeOf(service.filterAvailable(many, blackout))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(
      await codeOf(service.filterAvailable([listingId, 'nope'], blackout)),
    ).toBe(status.INVALID_ARGUMENT);
    expect(await codeOf(service.filterAvailable([listingId], undefined))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(
      await codeOf(
        service.filterAvailable([listingId], {
          start: blackout.end,
          end: blackout.start,
        }),
      ),
    ).toBe(status.INVALID_ARGUMENT);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('CalendarService.releaseCalendar', () => {
  const bookingId = '22222222-2222-4222-8222-222222222222';
  const renter = {
    sub: '00000000-0000-4000-8000-000000000003',
    role: 'student' as const,
  };

  function releaseSetup(bookingStatus: string | null) {
    const { tx, db, service } = setup();
    tx.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('FROM bookings') && bookingStatus
          ? [
              {
                renter_id: renter.sub,
                owner_id: owner.sub,
                status: bookingStatus,
              },
            ]
          : [],
      ),
    );
    const released = () =>
      tx.query.mock.calls.filter(([sql]) =>
        (sql as string).includes('UPDATE calendar_blocks'),
      );
    return { tx, db, service, released };
  }

  it('releases the reservation of a confirmed booking for either participant', async () => {
    for (const caller of [renter, owner]) {
      const { service, released } = releaseSetup('CONFIRMED');
      await service.releaseCalendar(caller, bookingId);
      expect(released()).toHaveLength(1);
      expect(released()[0][0]).toContain('released_at IS NULL');
      expect(released()[0][1]).toEqual([bookingId]);
    }
  });

  it('can be repeated, touching only blocks that are still active', async () => {
    const { service, released } = releaseSetup('CONFIRMED');
    await service.releaseCalendar(renter, bookingId);
    await service.releaseCalendar(renter, bookingId);
    expect(released()).toHaveLength(2);
  });

  it('refuses a booking that is not confirmed', async () => {
    const { service, released } = releaseSetup('PENDING');
    expect(await codeOf(service.releaseCalendar(renter, bookingId))).toBe(
      status.FAILED_PRECONDITION,
    );
    expect(released()).toHaveLength(0);
  });

  it('answers NOT_FOUND to anyone else and for an unknown booking', async () => {
    expect(
      await codeOf(
        releaseSetup('CONFIRMED').service.releaseCalendar(stranger, bookingId),
      ),
    ).toBe(status.NOT_FOUND);
    expect(
      await codeOf(
        releaseSetup(null).service.releaseCalendar(renter, bookingId),
      ),
    ).toBe(status.NOT_FOUND);
  });

  it('rejects an ID that is not a UUID', async () => {
    const { db, service } = releaseSetup('CONFIRMED');
    expect(await codeOf(service.releaseCalendar(renter, ''))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
