import { status } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import type { DataSource } from 'typeorm';
import type { PaymentClient } from '../clients/payment.client.js';
import type { RentalClient } from '../clients/rental.client.js';
import { BookingDecisionsService } from './booking-decisions.service.js';
import type { BookingRow } from './booking.row.js';
import type { Compensation } from './compensation.js';

const id = '22222222-2222-4222-8222-222222222222';
const owner = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'student' as const,
};
const renter = {
  sub: '00000000-0000-4000-8000-000000000002',
  role: 'student' as const,
};
const stranger = {
  sub: '00000000-0000-4000-8000-000000000003',
  role: 'student' as const,
};
const call = { correlationId: 'corr-1' };
const now = new Date('2026-10-29T05:00:00Z');

function row(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id,
    listing_id: '11111111-1111-4111-8111-111111111111',
    renter_id: renter.sub,
    owner_id: owner.sub,
    status: 'PENDING',
    period_start: new Date('2026-11-01T17:00:00Z'),
    period_end: new Date('2026-11-04T17:00:00Z'),
    rental_fee: 6000,
    deposit: 30000,
    late_fee_per_day: 4000,
    decline_reason: null,
    last_error: null,
    rental_id: null,
    expires_at: new Date('2026-10-30T05:00:00Z'),
    created_at: new Date('2026-10-29T04:00:00Z'),
    updated_at: new Date('2026-10-29T04:00:00Z'),
    ...overrides,
  };
}

interface State {
  booking: BookingRow;
  /** What a concurrent session left behind before this one's conditional update. */
  raced?: BookingRow;
  released?: boolean;
}

/** A fake booking_db that applies the service's status updates to one row. */
function setup(initial: BookingRow = row()) {
  const state: State = { booking: initial };
  const apply = (changes: Partial<BookingRow>) => {
    state.booking = { ...state.booking, ...changes };
    return [[state.booking], 1];
  };
  const tx = {
    query: vi.fn((sql: string, params: unknown[] = []) => {
      if (
        state.raced &&
        sql.includes("WHERE id = $1 AND status = 'AUTHORIZING'")
      ) {
        state.booking = state.raced;
        return Promise.resolve([[], 0]);
      }
      if (sql.includes("SET status = 'AUTHORIZING'")) {
        return Promise.resolve(apply({ status: 'AUTHORIZING' }));
      }
      if (sql.includes('SET last_error = $2')) {
        return Promise.resolve(apply({ last_error: params[1] as string }));
      }
      if (sql.includes("SET status = 'FAILED'")) {
        return Promise.resolve(
          apply({ status: 'FAILED', last_error: params[1] as string }),
        );
      }
      if (sql.includes("SET status = 'CONFIRMED'")) {
        return Promise.resolve(
          apply({ status: 'CONFIRMED', rental_id: params[1] as string }),
        );
      }
      if (sql.includes("SET status = 'DECLINED'")) {
        return Promise.resolve(
          apply({ status: 'DECLINED', decline_reason: params[1] as string }),
        );
      }
      if (sql.includes('WITH expired')) {
        state.booking = { ...state.booking, status: 'EXPIRED' };
        return Promise.resolve([{ id }]);
      }
      if (sql.includes('UPDATE calendar_blocks')) {
        state.released = true;
        return Promise.resolve([[], 1]);
      }
      if (sql.includes('FROM bookings WHERE id = $1')) {
        return Promise.resolve([state.booking]);
      }
      return Promise.resolve([]);
    }),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const payment = {
    authorize: vi.fn().mockResolvedValue({
      ok: true,
      value: { id: 'a', status: 'AUTHORIZED' },
    }),
  };
  const rental = {
    create: vi.fn().mockResolvedValue({ ok: true, value: { id: 'rental-1' } }),
  };
  const compensation = { voidHolds: vi.fn().mockResolvedValue(true) };
  const service = new BookingDecisionsService(
    db as unknown as DataSource,
    payment as unknown as PaymentClient,
    rental as unknown as RentalClient,
    compensation as unknown as Compensation,
  );
  const events = () =>
    tx.query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse(params?.[2] as string));
  return { state, tx, db, payment, rental, compensation, service, events };
}

async function codeOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (err) {
    return ((err as RpcException).getError() as { code: number }).code;
  }
  return undefined;
}

describe('BookingDecisionsService.approve', () => {
  it('confirms a PENDING request after authorizing and creating the rental', async () => {
    const { service, payment, rental, events } = setup();
    const booking = await service.approve(owner, id, call, now);
    expect(booking).toMatchObject({
      status: 'CONFIRMED',
      rental_id: 'rental-1',
    });
    expect(payment.authorize).toHaveBeenCalledTimes(2);
    expect(rental.create).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'booking.confirmed',
        recipients: [owner.sub, renter.sub],
        correlationId: 'corr-1',
        data: expect.objectContaining({ bookingId: id, status: 'CONFIRMED' }),
      }),
    ]);
  });

  it('keeps the booking AUTHORIZING with the reason when a call fails', async () => {
    const { service, payment, rental, events } = setup();
    payment.authorize.mockResolvedValueOnce({
      ok: false,
      reason: 'unavailable',
      message: 'The payment service is unavailable',
    });
    const booking = await service.approve(owner, id, call, now);
    expect(booking.status).toBe('AUTHORIZING');
    expect(booking.last_error).toBe(
      'Fee authorization is unavailable: The payment service is unavailable',
    );
    expect(rental.create).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
  });

  it('fails the booking, releases the dates and voids the holds when Payment declines', async () => {
    const { service, payment, rental, compensation, state, events } = setup();
    payment.authorize.mockResolvedValueOnce({
      ok: false,
      reason: 'declined',
      message: 'No payment method',
    });
    const booking = await service.approve(owner, id, call, now);
    expect(booking.status).toBe('FAILED');
    expect(booking.last_error).toContain('No payment method');
    expect(state.released).toBe(true);
    expect(rental.create).not.toHaveBeenCalled();
    expect(compensation.voidHolds).toHaveBeenCalledWith(id, call);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'booking.failed',
        recipients: [owner.sub, renter.sub],
      }),
    ]);
  });

  it('retries an AUTHORIZING booking with the same calls', async () => {
    const { service, payment } = setup(
      row({ status: 'AUTHORIZING', last_error: 'down' }),
    );
    const booking = await service.approve(owner, id, call, now);
    expect(booking).toMatchObject({ status: 'CONFIRMED', last_error: 'down' });
    expect(payment.authorize.mock.calls[0][0].operationId).toBe(
      `booking:${id}:authorize-fee`,
    );
  });

  it('retries an AUTHORIZING booking even after its answer window', async () => {
    const { service } = setup(
      row({
        status: 'AUTHORIZING',
        expires_at: new Date('2026-10-28T00:00:00Z'),
      }),
    );
    expect((await service.approve(owner, id, call, now)).status).toBe(
      'CONFIRMED',
    );
  });

  it('fails an AUTHORIZING booking once the period has started', async () => {
    const { service, payment, compensation, state } = setup(
      row({ status: 'AUTHORIZING' }),
    );
    const booking = await service.approve(
      owner,
      id,
      call,
      new Date('2026-11-01T17:00:00Z'),
    );
    expect(booking.status).toBe('FAILED');
    expect(state.released).toBe(true);
    expect(payment.authorize).not.toHaveBeenCalled();
    expect(compensation.voidHolds).toHaveBeenCalledWith(id, call);
  });

  it('refuses to approve a FAILED booking again', async () => {
    const { service } = setup(row({ status: 'FAILED' }));
    expect(await codeOf(service.approve(owner, id, call, now))).toBe(
      status.FAILED_PRECONDITION,
    );
  });

  it('returns a CONFIRMED booking as it is', async () => {
    const confirmed = row({ status: 'CONFIRMED', rental_id: 'rental-1' });
    const { service, payment, events } = setup(confirmed);
    await expect(service.approve(owner, id, call, now)).resolves.toEqual(
      confirmed,
    );
    expect(payment.authorize).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
  });

  it('confirms once when two approvals race', async () => {
    const { state, service, events } = setup(row({ status: 'AUTHORIZING' }));
    state.raced = row({ status: 'CONFIRMED', rental_id: 'rental-1' });
    const booking = await service.approve(owner, id, call, now);
    expect(booking).toMatchObject({
      status: 'CONFIRMED',
      rental_id: 'rental-1',
    });
    expect(events()).toEqual([]);
  });

  it('expires a stale PENDING request and answers FAILED_PRECONDITION', async () => {
    const { state, service, payment } = setup(
      row({ expires_at: new Date('2026-10-29T05:00:00Z') }),
    );
    expect(await codeOf(service.approve(owner, id, call, now))).toBe(
      status.FAILED_PRECONDITION,
    );
    expect(state.booking.status).toBe('EXPIRED');
    expect(payment.authorize).not.toHaveBeenCalled();
  });

  it.each(['DECLINED', 'EXPIRED', 'CANCELLED'] as const)(
    'refuses a %s booking',
    async (current) => {
      const { service } = setup(row({ status: current }));
      expect(await codeOf(service.approve(owner, id, call, now))).toBe(
        status.FAILED_PRECONDITION,
      );
    },
  );

  it('lets only the owner approve', async () => {
    const { service, payment } = setup();
    expect(await codeOf(service.approve(renter, id, call, now))).toBe(
      status.PERMISSION_DENIED,
    );
    expect(await codeOf(service.approve(stranger, id, call, now))).toBe(
      status.NOT_FOUND,
    );
    expect(payment.authorize).not.toHaveBeenCalled();
  });

  it('rejects an ID that is not a UUID', async () => {
    const { db, service } = setup();
    expect(await codeOf(service.approve(owner, 'x', call, now))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe('BookingDecisionsService.decline', () => {
  it('declines a PENDING request, releases the dates and tells the renter', async () => {
    const { state, service, events } = setup();
    const booking = await service.decline(
      owner,
      id,
      '  Away that week ',
      call,
      now,
    );
    expect(booking).toMatchObject({
      status: 'DECLINED',
      decline_reason: 'Away that week',
    });
    expect(state.released).toBe(true);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'booking.declined',
        recipients: [renter.sub],
        data: expect.objectContaining({ bookingId: id, status: 'DECLINED' }),
      }),
    ]);
  });

  it('stores no reason when none is given', async () => {
    const { service } = setup();
    const booking = await service.decline(owner, id, '', call, now);
    expect(booking.decline_reason).toBeNull();
  });

  it('rejects a reason longer than 500 characters', async () => {
    const { db, service } = setup();
    expect(
      await codeOf(service.decline(owner, id, 'x'.repeat(501), call, now)),
    ).toBe(status.INVALID_ARGUMENT);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each(['AUTHORIZING', 'CONFIRMED', 'DECLINED'] as const)(
    'refuses a %s booking without releasing it',
    async (current) => {
      const { state, service } = setup(row({ status: current }));
      expect(await codeOf(service.decline(owner, id, '', call, now))).toBe(
        status.FAILED_PRECONDITION,
      );
      expect(state.released).toBeUndefined();
    },
  );

  it('expires a stale PENDING request and answers FAILED_PRECONDITION', async () => {
    const { state, service, events } = setup(
      row({ expires_at: new Date('2026-10-29T04:59:00Z') }),
    );
    expect(await codeOf(service.decline(owner, id, '', call, now))).toBe(
      status.FAILED_PRECONDITION,
    );
    expect(state.booking.status).toBe('EXPIRED');
    expect(events()).toEqual([]);
  });

  it('lets only the owner decline', async () => {
    const { service } = setup();
    expect(await codeOf(service.decline(renter, id, '', call, now))).toBe(
      status.PERMISSION_DENIED,
    );
    expect(await codeOf(service.decline(stranger, id, '', call, now))).toBe(
      status.NOT_FOUND,
    );
  });
});
