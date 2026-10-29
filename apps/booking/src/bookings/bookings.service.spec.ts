import { status } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { type DataSource, QueryFailedError } from 'typeorm';
import type { IdentityClient } from '../clients/identity.client.js';
import type { ListingClient } from '../clients/listing.client.js';
import { rpcError } from '../errors.js';
import type { BookingRow } from './booking.row.js';
import { BookingsService } from './bookings.service.js';

const listingId = '11111111-1111-4111-8111-111111111111';
const owner = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'student' as const,
};
const renter = {
  sub: '00000000-0000-4000-8000-000000000002',
  role: 'student' as const,
};
const call = { correlationId: 'corr-1' };
const now = new Date('2026-10-29T05:00:00Z');
const period = { start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' };
const quote = {
  listingId,
  ownerId: owner.sub,
  days: 3,
  rentalFee: 6000,
  deposit: 30000,
  lateFeePerDay: 4000,
};

interface Options {
  open?: number;
  calendar?: boolean;
  blockError?: unknown;
}

function setup({ open = 0, calendar = true, blockError }: Options = {}) {
  const tx = {
    query: vi.fn((sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM calendars')) {
        return Promise.resolve(calendar ? [{}] : []);
      }
      if (sql.includes('count(*)')) {
        return Promise.resolve([{ open }]);
      }
      if (sql.includes('INSERT INTO bookings')) {
        return Promise.resolve([
          {
            id: params[0],
            listing_id: params[1],
            renter_id: params[2],
            owner_id: params[3],
            status: 'PENDING',
            period_start: params[4],
            period_end: params[5],
          } as BookingRow,
        ]);
      }
      if (sql.includes('INSERT INTO calendar_blocks') && blockError) {
        return Promise.reject(blockError);
      }
      return Promise.resolve([]);
    }),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const identity = { requireBooker: vi.fn().mockResolvedValue(undefined) };
  const listing = { quote: vi.fn().mockResolvedValue(quote) };
  const service = new BookingsService(
    db as unknown as DataSource,
    identity as unknown as IdentityClient,
    listing as unknown as ListingClient,
  );
  const statements = () => tx.query.mock.calls.map(([sql]) => sql);
  return { tx, db, identity, listing, service, statements };
}

async function codeOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (err) {
    return ((err as RpcException).getError() as { code: number }).code;
  }
  return undefined;
}

describe('BookingsService.request', () => {
  it('reserves the dates and stores a PENDING booking with the quoted terms', async () => {
    const { tx, service, statements, identity, listing } = setup();
    const booking = await service.request(renter, listingId, period, call, now);
    expect(booking.status).toBe('PENDING');
    expect(identity.requireBooker).toHaveBeenCalledWith(renter.sub, call);
    expect(listing.quote).toHaveBeenCalledWith(
      listingId,
      { start: new Date(period.start), end: new Date(period.end) },
      call,
    );
    const insert = tx.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO bookings'),
    );
    expect(insert?.[1]?.slice(1)).toEqual([
      listingId,
      renter.sub,
      owner.sub,
      new Date(period.start),
      new Date(period.end),
      6000,
      30000,
      4000,
      new Date('2026-10-30T05:00:00Z'),
    ]);
    const block = tx.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO calendar_blocks'),
    );
    expect(block?.[1]).toEqual([
      listingId,
      new Date(period.start),
      new Date(period.end),
      booking.id,
    ]);
    expect(statements()[0]).toContain('pg_advisory_xact_lock');
  });

  it('tells the owner about the request in the same transaction', async () => {
    const { tx, service, statements } = setup();
    const booking = await service.request(renter, listingId, period, call, now);
    const index = statements().findIndex((sql) =>
      sql.includes('INSERT INTO outbox_events'),
    );
    expect(index).toBeGreaterThan(
      statements().findIndex((sql) =>
        sql.includes('INSERT INTO calendar_blocks'),
      ),
    );
    const envelope = JSON.parse(tx.query.mock.calls[index][1]?.[2] as string);
    expect(envelope).toMatchObject({
      type: 'booking.requested',
      producer: 'booking',
      correlationId: 'corr-1',
      recipients: [owner.sub],
      data: {
        bookingId: booking.id,
        listingId,
        ownerId: owner.sub,
        renterId: renter.sub,
        period: {
          start: '2026-11-01T17:00:00.000Z',
          end: '2026-11-04T17:00:00.000Z',
        },
        status: 'PENDING',
      },
    });
  });

  it('writes no event when the dates are taken', async () => {
    const { service, statements } = setup({
      blockError: new QueryFailedError('INSERT', [], {
        code: '23P01',
      } as unknown as Error),
    });
    await codeOf(service.request(renter, listingId, period, call, now));
    expect(statements().some((sql) => sql.includes('outbox_events'))).toBe(
      false,
    );
  });

  it('releases stale PENDING requests of the listing and renter before reserving', async () => {
    const { tx, service, statements } = setup();
    await service.request(renter, listingId, period, call, now);
    const expiry = statements().findIndex((sql) =>
      sql.includes('WITH expired'),
    );
    const reserve = statements().findIndex((sql) =>
      sql.includes('INSERT INTO calendar_blocks'),
    );
    expect(expiry).toBeGreaterThan(-1);
    expect(expiry).toBeLessThan(reserve);
    expect(tx.query.mock.calls[expiry][1]).toEqual([
      now,
      listingId,
      renter.sub,
    ]);
  });

  it('refuses the owner of the listing', async () => {
    const { db, service } = setup();
    expect(
      await codeOf(service.request(owner, listingId, period, call, now)),
    ).toBe(status.PERMISSION_DENIED);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('refuses a renter Identity does not allow to book', async () => {
    const { identity, listing, service } = setup();
    identity.requireBooker.mockRejectedValueOnce(
      rpcError(
        status.PERMISSION_DENIED,
        'You cannot book yet: EMAIL_NOT_VERIFIED',
      ),
    );
    expect(
      await codeOf(service.request(renter, listingId, period, call, now)),
    ).toBe(status.PERMISSION_DENIED);
    expect(listing.quote).not.toHaveBeenCalled();
  });

  it('allows a fifth open request', async () => {
    const { service } = setup({ open: 4 });
    expect(
      await codeOf(service.request(renter, listingId, period, call, now)),
    ).toBeUndefined();
  });

  it('refuses a sixth open request without inserting', async () => {
    const { service, statements } = setup({ open: 5 });
    expect(
      await codeOf(service.request(renter, listingId, period, call, now)),
    ).toBe(status.FAILED_PRECONDITION);
    expect(statements().some((sql) => sql.includes('INSERT'))).toBe(false);
  });

  it('answers ALREADY_EXISTS when the dates overlap another block', async () => {
    const { service } = setup({
      blockError: new QueryFailedError('INSERT', [], {
        code: '23P01',
      } as unknown as Error),
    });
    expect(
      await codeOf(service.request(renter, listingId, period, call, now)),
    ).toBe(status.ALREADY_EXISTS);
  });

  it('answers NOT_FOUND for a listing without a calendar', async () => {
    const { service } = setup({ calendar: false });
    expect(
      await codeOf(service.request(renter, listingId, period, call, now)),
    ).toBe(status.NOT_FOUND);
  });

  it.each([
    ['a listing ID that is not a UUID', 'nope', period],
    ['a missing period', listingId, undefined],
    [
      'a period that has started',
      listingId,
      { start: '2026-10-28T17:00:00Z', end: '2026-10-30T17:00:00Z' },
    ],
    [
      'a period ending after 366 days',
      listingId,
      { start: '2027-10-29T17:00:00Z', end: '2027-11-01T17:00:00Z' },
    ],
  ])('rejects %s before calling anyone', async (_case, id, range) => {
    const { identity, db, service } = setup();
    expect(await codeOf(service.request(renter, id, range, call, now))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(identity.requireBooker).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

function readSetup(rows: Partial<BookingRow>[]) {
  const { tx, service } = setup();
  tx.query.mockImplementation((sql: string) =>
    Promise.resolve(sql.includes('SELECT id, listing_id') ? rows : []),
  );
  return { tx, service };
}

const bookingId = '22222222-2222-4222-8222-222222222222';

describe('BookingsService.get', () => {
  it('returns a booking of the caller after expiring it if stale', async () => {
    const { tx, service } = readSetup([{ id: bookingId }]);
    await expect(service.get(renter, bookingId, now)).resolves.toEqual({
      id: bookingId,
    });
    const [expirySql, expiryParams] = tx.query.mock.calls[0];
    expect(expirySql).toContain('WITH expired');
    expect(expiryParams).toEqual([now, bookingId, renter.sub]);
    const [, selectParams] = tx.query.mock.calls[1];
    expect(selectParams).toEqual([bookingId, renter.sub]);
  });

  it('answers NOT_FOUND to anyone but the renter and owner', async () => {
    const { service } = readSetup([]);
    expect(await codeOf(service.get(renter, bookingId, now))).toBe(
      status.NOT_FOUND,
    );
  });

  it('rejects an ID that is not a UUID', async () => {
    const { db, service } = setup();
    expect(await codeOf(service.get(renter, '', now))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe('BookingsService.list', () => {
  it('lists the caller requests as renter, newest first, at most 100', async () => {
    const { tx, service } = readSetup([{ id: bookingId }]);
    await expect(service.list(renter, 'renter', '', now)).resolves.toEqual([
      { id: bookingId },
    ]);
    expect(tx.query.mock.calls[0][1]).toEqual([now, renter.sub]);
    const [sql, params] = tx.query.mock.calls[1];
    expect(sql).toContain('WHERE renter_id = $1');
    expect(sql).toContain('ORDER BY created_at DESC');
    expect(params).toEqual([renter.sub, null, 100]);
  });

  it('lists requests on the caller listings with a status filter', async () => {
    const { tx, service } = readSetup([]);
    await service.list(owner, 'owner', 'PENDING', now);
    const [sql, params] = tx.query.mock.calls[1];
    expect(sql).toContain('WHERE owner_id = $1');
    expect(params).toEqual([owner.sub, 'PENDING', 100]);
  });

  it('rejects an unknown role or status', async () => {
    const { db, service } = setup();
    expect(await codeOf(service.list(owner, 'admin', '', now))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(await codeOf(service.list(owner, 'owner', 'DONE', now))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
