import { status } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import type { DataSource } from 'typeorm';
import type { RentalClient } from '../clients/rental.client.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
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

const confirmed = () => row({ status: 'CONFIRMED', rental_id: 'rental-1' });

interface State {
  booking: BookingRow;
  /** What a concurrent cancellation left behind before this one's conditional update. */
  raced?: BookingRow;
  released?: boolean;
}

/** A fake booking_db that applies the service's status updates to one row. */
function setup(initial: BookingRow = row()) {
  const state: State = { booking: initial };
  const tx = {
    query: vi.fn((sql: string, params: unknown[] = []) => {
      if (sql.includes("SET status = 'CANCELLED'")) {
        if (state.raced) {
          state.booking = state.raced;
          return Promise.resolve([[], 0]);
        }
        if (state.booking.status !== params[1]) {
          return Promise.resolve([[], 0]);
        }
        state.booking = { ...state.booking, status: 'CANCELLED' };
        return Promise.resolve([[state.booking], 1]);
      }
      if (sql.includes('WITH expired')) {
        state.booking = { ...state.booking, status: 'EXPIRED' };
        return Promise.resolve([state.booking]);
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
  const rental = {
    cancelByBooking: vi
      .fn()
      .mockResolvedValue({ ok: true, value: 'cancelled' }),
  };
  const compensation = { voidHolds: vi.fn().mockResolvedValue(true) };
  const service = new BookingCancellationService(
    db as unknown as DataSource,
    rental as unknown as RentalClient,
    compensation as unknown as Compensation,
  );
  const events = () =>
    tx.query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse(params?.[2] as string));
  return { state, tx, db, rental, compensation, service, events };
}

async function codeOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (err) {
    return ((err as RpcException).getError() as { code: number }).code;
  }
  return undefined;
}

describe('BookingCancellationService', () => {
  describe('a PENDING request', () => {
    it.each([
      ['renter', renter],
      ['owner', owner],
    ])('is cancelled by the %s, releasing the dates', async (_who, caller) => {
      const { service, state, rental, compensation, events } = setup();
      const booking = await service.cancel(caller, id, '', call, now);
      expect(booking.status).toBe('CANCELLED');
      expect(state.released).toBe(true);
      expect(rental.cancelByBooking).not.toHaveBeenCalled();
      expect(compensation.voidHolds).not.toHaveBeenCalled();
      expect(events()).toEqual([
        expect.objectContaining({
          type: 'booking.cancelled',
          recipients: [owner.sub, renter.sub],
          correlationId: 'corr-1',
          data: expect.not.objectContaining({ reason: expect.anything() }),
        }),
      ]);
    });

    it('carries the trimmed reason in the event', async () => {
      const { service, events } = setup();
      await service.cancel(renter, id, '  Plans changed ', call, now);
      expect(events()[0].data).toMatchObject({
        status: 'CANCELLED',
        reason: 'Plans changed',
      });
    });

    it('expires a stale request instead and answers FAILED_PRECONDITION', async () => {
      const { service, state, events } = setup(
        row({ expires_at: new Date('2026-10-29T04:00:00Z') }),
      );
      expect(await codeOf(service.cancel(renter, id, '', call, now))).toBe(
        status.FAILED_PRECONDITION,
      );
      expect(state.booking.status).toBe('EXPIRED');
      expect(events().map((event) => event.type)).toEqual(['booking.expired']);
    });
  });

  describe('a CONFIRMED booking', () => {
    it('cancels the rental first, then releases the dates, announces and voids the holds', async () => {
      const { service, state, tx, rental, compensation, events } =
        setup(confirmed());
      const booking = await service.cancel(owner, id, 'Broken', call, now);
      expect(booking.status).toBe('CANCELLED');
      expect(rental.cancelByBooking).toHaveBeenCalledWith(id, call);
      const cancelSql = tx.query.mock.calls.findIndex(([sql]) =>
        sql.includes("SET status = 'CANCELLED'"),
      );
      expect(rental.cancelByBooking.mock.invocationCallOrder[0]).toBeLessThan(
        tx.query.mock.invocationCallOrder[cancelSql],
      );
      expect(tx.query.mock.calls[cancelSql][1]).toEqual([id, 'CONFIRMED']);
      expect(state.released).toBe(true);
      expect(events()).toEqual([
        expect.objectContaining({
          type: 'booking.cancelled',
          recipients: [owner.sub, renter.sub],
          data: expect.objectContaining({ reason: 'Broken' }),
        }),
      ]);
      expect(compensation.voidHolds).toHaveBeenCalledWith(id, call);
    });

    it('goes ahead when Rental has no rental for the booking', async () => {
      const { service, rental } = setup(confirmed());
      rental.cancelByBooking.mockResolvedValueOnce({
        ok: true,
        value: 'no-rental',
      });
      expect((await service.cancel(renter, id, '', call, now)).status).toBe(
        'CANCELLED',
      );
    });

    it('answers FAILED_PRECONDITION and changes nothing once the item is picked up', async () => {
      const { service, state, rental, compensation, events } =
        setup(confirmed());
      rental.cancelByBooking.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'The item was already picked up',
      });
      expect(await codeOf(service.cancel(renter, id, '', call, now))).toBe(
        status.FAILED_PRECONDITION,
      );
      expect(state.booking.status).toBe('CONFIRMED');
      expect(state.released).toBeUndefined();
      expect(events()).toEqual([]);
      expect(compensation.voidHolds).not.toHaveBeenCalled();
    });

    it('answers UNAVAILABLE when Rental does not answer', async () => {
      const { service, state, rental } = setup(confirmed());
      rental.cancelByBooking.mockResolvedValueOnce({
        ok: false,
        reason: 'unavailable',
        message: 'The rental service is unavailable',
      });
      expect(await codeOf(service.cancel(renter, id, '', call, now))).toBe(
        status.UNAVAILABLE,
      );
      expect(state.booking.status).toBe('CONFIRMED');
    });

    it('stays CANCELLED with the void left to the sweeper when Payment does not answer', async () => {
      const { service, compensation } = setup(confirmed());
      compensation.voidHolds.mockResolvedValueOnce(false);
      expect((await service.cancel(renter, id, '', call, now)).status).toBe(
        'CANCELLED',
      );
      expect(compensation.voidHolds).toHaveBeenCalledTimes(1);
    });

    it('announces and voids once when a concurrent cancellation wins', async () => {
      const { service, state, compensation, events } = setup(confirmed());
      state.raced = { ...confirmed(), status: 'CANCELLED' };
      const booking = await service.cancel(renter, id, '', call, now);
      expect(booking.status).toBe('CANCELLED');
      expect(events()).toEqual([]);
      expect(compensation.voidHolds).not.toHaveBeenCalled();
    });
  });

  it('returns a CANCELLED booking unchanged', async () => {
    const { service, rental, compensation, events, tx } = setup(
      row({ status: 'CANCELLED', rental_id: 'rental-1' }),
    );
    const booking = await service.cancel(owner, id, '', call, now);
    expect(booking.status).toBe('CANCELLED');
    expect(rental.cancelByBooking).not.toHaveBeenCalled();
    expect(compensation.voidHolds).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
    expect(
      tx.query.mock.calls.some(([sql]) => sql.trimStart().startsWith('UPDATE')),
    ).toBe(false);
  });

  it.each(['AUTHORIZING', 'DECLINED', 'EXPIRED', 'FAILED'] as const)(
    'refuses a %s booking with FAILED_PRECONDITION',
    async (current) => {
      const { service, rental } = setup(row({ status: current }));
      expect(await codeOf(service.cancel(renter, id, '', call, now))).toBe(
        status.FAILED_PRECONDITION,
      );
      expect(rental.cancelByBooking).not.toHaveBeenCalled();
    },
  );

  it('lets only the renter and the owner cancel', async () => {
    const { service, state } = setup();
    expect(await codeOf(service.cancel(stranger, id, '', call, now))).toBe(
      status.PERMISSION_DENIED,
    );
    expect(state.booking.status).toBe('PENDING');
  });

  it('answers NOT_FOUND for an unknown booking', async () => {
    const { service, tx } = setup();
    tx.query.mockResolvedValueOnce([]);
    expect(await codeOf(service.cancel(renter, id, '', call, now))).toBe(
      status.NOT_FOUND,
    );
  });

  it('rejects a bad ID or a reason over 200 characters before reading', async () => {
    const { service, db } = setup();
    expect(await codeOf(service.cancel(renter, 'x', '', call, now))).toBe(
      status.INVALID_ARGUMENT,
    );
    expect(
      await codeOf(service.cancel(renter, id, 'x'.repeat(201), call, now)),
    ).toBe(status.INVALID_ARGUMENT);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
