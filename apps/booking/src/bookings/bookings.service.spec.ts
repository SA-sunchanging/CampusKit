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
          { id: params[0], status: 'PENDING' } as BookingRow,
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
