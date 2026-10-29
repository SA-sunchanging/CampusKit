import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { BookingClient } from '../clients/booking.client.js';
import type { ServiceResult } from '../clients/http-call.js';
import type { PaymentClient } from '../clients/payment.client.js';
import { FakeRentalDb } from '../testing/fake-rental-db.js';
import {
  BOOKING_ID,
  errorOf,
  OWNER_ID,
  RENTAL_ID,
  RENTER_ID,
  rentalRow,
  STRANGER_ID,
} from '../testing/fixtures.js';
import type { RentalRow } from './rental.row.js';
import { ReturnService } from './return.service.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };
const stranger = { sub: STRANGER_ID, role: 'student' as const };
const call = { authorization: 'Bearer owner', correlationId: 'corr-1' };
/** The fixture period ends 2026-11-04T17:00Z. */
const onTime = new Date('2026-11-04T12:00:00Z');
const pickedUpAt = new Date('2026-11-01T10:00:00Z');
const settled = {
  bookingId: BOOKING_ID,
  lateFeeCharged: 0,
  depositReleased: 30000,
  payout: 6000,
};

function activeRow(overrides: Partial<RentalRow> = {}): RentalRow {
  return rentalRow({
    status: 'ACTIVE',
    picked_up_at: pickedUpAt,
    ...overrides,
  });
}

function pendingRow(overrides: Partial<RentalRow> = {}): RentalRow {
  return activeRow({
    status: 'SETTLEMENT_PENDING',
    returned_at: new Date('2026-11-05T18:00:00Z'),
    late_days: 2,
    late_fee: 8000,
    last_error: 'Settlement is unavailable: The payment service is unavailable',
    ...overrides,
  });
}

function setup(row: RentalRow | null = activeRow()) {
  const fake = new FakeRentalDb(row ?? undefined);
  const booking = {
    releaseCalendar: vi.fn(
      (_id: string, _call: unknown): Promise<ServiceResult<true>> =>
        Promise.resolve({ ok: true, value: true }),
    ),
  };
  const payment = {
    settle: vi.fn(
      (_request: unknown, _call: unknown): Promise<ServiceResult<unknown>> =>
        Promise.resolve({ ok: true, value: settled }),
    ),
  };
  const service = new ReturnService(
    fake.dataSource,
    booking as unknown as BookingClient,
    payment as unknown as PaymentClient,
  );
  const confirmReturn = (
    code: string | null = '987654',
    caller = owner,
    at = onTime,
  ) => service.confirmReturn(caller, RENTAL_ID, code ?? undefined, call, at);
  return { fake, booking, payment, confirmReturn };
}

describe('ReturnService', () => {
  it('accepts the return, releases the dates, settles and closes', async () => {
    const { fake, booking, payment, confirmReturn } = setup(
      activeRow({ return_attempts: 2 }),
    );
    const rental = await confirmReturn();
    expect(booking.releaseCalendar).toHaveBeenCalledWith(BOOKING_ID, call);
    expect(payment.settle).toHaveBeenCalledWith(
      {
        operationId: `rental:${RENTAL_ID}:settle`,
        bookingId: BOOKING_ID,
        deposit: 30000,
        lateFee: 0,
      },
      call,
    );
    expect(fake.row).toMatchObject({
      status: 'CLOSED',
      returned_at: onTime,
      closed_at: onTime,
      late_days: 0,
      late_fee: 0,
      return_attempts: 0,
      last_error: null,
    });
    expect(rental).toMatchObject({
      status: 'CLOSED',
      returnedAt: onTime.toISOString(),
      closedAt: onTime.toISOString(),
      returnCode: '',
      lastError: '',
    });
  });

  it('charges the late fee for each started day after the end', async () => {
    const { fake, payment, confirmReturn } = setup();
    const late = new Date('2026-11-05T18:00:00Z');
    await confirmReturn('987654', owner, late);
    expect(payment.settle.mock.calls[0][0]).toMatchObject({ lateFee: 8000 });
    expect(fake.row).toMatchObject({ late_days: 2, late_fee: 8000 });
  });

  it('announces rental.closed with the late fee to the owner and the renter', async () => {
    const { fake, confirmReturn } = setup();
    await confirmReturn('987654', owner, new Date('2026-11-05T18:00:00Z'));
    expect(fake.events()).toEqual([
      expect.objectContaining({
        type: 'rental.closed',
        producer: 'rental',
        recipients: [OWNER_ID, RENTER_ID],
        correlationId: 'corr-1',
        data: expect.objectContaining({
          rentalId: RENTAL_ID,
          status: 'CLOSED',
          lateFee: 8000,
        }) as unknown,
      }),
    ]);
  });

  it('moves ACTIVE and SETTLEMENT_PENDING on only with conditional updates', async () => {
    const { fake, confirmReturn } = setup();
    await confirmReturn();
    const [accept, close] = fake.updates();
    expect(accept).toContain("WHERE id = $1 AND status = 'ACTIVE'");
    expect(close).toContain("WHERE id = $1 AND status = 'SETTLEMENT_PENDING'");
  });

  describe('who may confirm the return', () => {
    it.each([
      ['someone who does not take part', stranger],
      ['an unknown rental', owner],
    ])('answers 404 to %s', async (label, caller) => {
      const { booking, confirmReturn } = setup(
        label === 'an unknown rental' ? null : activeRow(),
      );
      const err = await errorOf(confirmReturn('987654', caller));
      expect(err).toBeInstanceOf(NotFoundException);
      expect(booking.releaseCalendar).not.toHaveBeenCalled();
    });

    it('answers 403 to the renter without counting the code', async () => {
      const { fake, confirmReturn } = setup();
      const err = await errorOf(confirmReturn('000000', renter));
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as Error).message).toBe(
        'Only the owner can confirm the return',
      );
      expect(fake.row?.return_attempts).toBe(0);
    });
  });

  it.each([
    ['AWAITING_PICKUP', 'The item has not been picked up yet'],
    ['CLOSED', 'The rental is already closed'],
    ['CANCELLED', 'The booking was cancelled before pickup'],
  ] as const)('answers 409 when the rental is %s', async (status, message) => {
    const { booking, payment, confirmReturn } = setup(rentalRow({ status }));
    const err = await errorOf(confirmReturn());
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe(message);
    expect(booking.releaseCalendar).not.toHaveBeenCalled();
    expect(payment.settle).not.toHaveBeenCalled();
  });

  describe('return code', () => {
    it.each([null, ''])(
      'answers 400 without a code (%j) and counts nothing',
      async (code) => {
        const { fake, confirmReturn } = setup();
        const err = await errorOf(confirmReturn(code));
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as Error).message).toBe('The return code is required');
        expect(fake.row).toMatchObject({
          status: 'ACTIVE',
          return_attempts: 0,
        });
      },
    );

    it('answers 400 for a wrong code and keeps the counted attempt', async () => {
      const { fake, booking, confirmReturn } = setup();
      const err = await errorOf(confirmReturn('000000'));
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toBe('Wrong return code');
      expect(fake.row).toMatchObject({ status: 'ACTIVE', return_attempts: 1 });
      expect(booking.releaseCalendar).not.toHaveBeenCalled();
    });

    it('replaces the code at the fifth wrong attempt', async () => {
      const { fake, confirmReturn } = setup(activeRow({ return_attempts: 4 }));
      await expect(confirmReturn('000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fake.row?.return_attempts).toBe(0);
      expect(fake.row?.return_code).toMatch(/^[0-9]{6}$/);
      expect(fake.row?.status).toBe('ACTIVE');
    });
  });

  describe('failed settlement', () => {
    it('stays SETTLEMENT_PENDING when Booking refuses to release the dates', async () => {
      const { fake, booking, payment, confirmReturn } = setup();
      booking.releaseCalendar.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'Only a confirmed booking can release its dates',
      });
      const rental = await confirmReturn();
      expect(payment.settle).not.toHaveBeenCalled();
      expect(rental).toMatchObject({
        status: 'SETTLEMENT_PENDING',
        lastError:
          'Calendar release was declined: Only a confirmed booking can release its dates',
        returnedAt: onTime.toISOString(),
        closedAt: '',
      });
      expect(fake.row?.status).toBe('SETTLEMENT_PENDING');
      expect(fake.events()).toEqual([]);
    });

    it('stays SETTLEMENT_PENDING when Payment is unavailable', async () => {
      const { fake, payment, confirmReturn } = setup();
      payment.settle.mockResolvedValueOnce({
        ok: false,
        reason: 'unavailable',
        message: 'The payment service is unavailable',
      });
      const rental = await confirmReturn();
      expect(rental).toMatchObject({
        status: 'SETTLEMENT_PENDING',
        lastError:
          'Settlement is unavailable: The payment service is unavailable',
      });
      expect(fake.events()).toEqual([]);
    });

    it('stays SETTLEMENT_PENDING when Payment refuses', async () => {
      const { payment, confirmReturn } = setup();
      payment.settle.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'The deposit authorization has expired',
      });
      const rental = await confirmReturn();
      expect(rental.lastError).toBe(
        'Settlement was declined: The deposit authorization has expired',
      );
    });
  });

  describe('retry of a SETTLEMENT_PENDING rental', () => {
    it('needs no code and reuses the stored return time and late fee', async () => {
      const { fake, booking, payment, confirmReturn } = setup(pendingRow());
      const muchLater = new Date('2026-11-20T00:00:00Z');
      const rental = await confirmReturn(null, owner, muchLater);
      expect(booking.releaseCalendar).toHaveBeenCalledTimes(1);
      expect(payment.settle.mock.calls[0][0]).toEqual({
        operationId: `rental:${RENTAL_ID}:settle`,
        bookingId: BOOKING_ID,
        deposit: 30000,
        lateFee: 8000,
      });
      expect(fake.row).toMatchObject({
        status: 'CLOSED',
        returned_at: new Date('2026-11-05T18:00:00Z'),
        late_days: 2,
        late_fee: 8000,
        closed_at: muchLater,
        last_error: null,
      });
      expect(rental.status).toBe('CLOSED');
    });

    it('ignores a code, right or wrong', async () => {
      const { fake, confirmReturn } = setup(pendingRow());
      const rental = await confirmReturn('000000');
      expect(rental.status).toBe('CLOSED');
      expect(fake.row?.return_attempts).toBe(0);
    });
  });

  describe('races', () => {
    it('returns the rental closed by a concurrent return', async () => {
      const { fake, payment, confirmReturn } = setup(pendingRow());
      const closedAt = new Date('2026-11-05T19:00:00Z');
      payment.settle.mockImplementationOnce(() => {
        fake.set({
          ...(fake.row as RentalRow),
          status: 'CLOSED',
          closed_at: closedAt,
          last_error: null,
        });
        return Promise.resolve({ ok: true, value: settled });
      });
      const rental = await confirmReturn(null);
      expect(rental).toMatchObject({
        status: 'CLOSED',
        closedAt: closedAt.toISOString(),
      });
      expect(fake.events()).toEqual([]);
    });

    it('does not store an error on a rental a concurrent return closed', async () => {
      const { fake, payment, confirmReturn } = setup(pendingRow());
      payment.settle.mockImplementationOnce(() => {
        fake.set({
          ...(fake.row as RentalRow),
          status: 'CLOSED',
          last_error: null,
        });
        return Promise.resolve({
          ok: false,
          reason: 'unavailable',
          message: 'The payment service is unavailable',
        });
      });
      const rental = await confirmReturn(null);
      expect(rental).toMatchObject({ status: 'CLOSED', lastError: '' });
    });
  });
});
