import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { BookingClient } from '../clients/booking.client.js';
import type { ServiceResult } from '../clients/http-call.js';
import type { PaymentClient } from '../clients/payment.client.js';
import { FakeRentalDb } from '../testing/fake-rental-db.js';
import {
  BOOKING_ID,
  confirmedBooking,
  errorOf,
  OWNER_ID,
  RENTAL_ID,
  RENTER_ID,
  rentalRow,
  STRANGER_ID,
} from '../testing/fixtures.js';
import { PICKUP_CLAIM_LEASE_MS } from './pickup-claim.js';
import { PickupService } from './pickup.service.js';
import { RentalCancellationService } from './rental-cancellation.service.js';
import type { RentalRow } from './rental.row.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };
const stranger = { sub: STRANGER_ID, role: 'student' as const };
const call = { authorization: 'Bearer renter', correlationId: 'corr-1' };
/** Inside the pickup window of the fixture period, which starts 2026-11-01T17:00Z. */
const now = new Date('2026-11-01T10:00:00Z');
const captured = {
  bookingId: BOOKING_ID,
  kind: 'FEE',
  capturedAmount: 6000,
  status: 'CAPTURED',
};

function setup(row: RentalRow | null = rentalRow()) {
  const fake = new FakeRentalDb(row ?? undefined);
  const booking = {
    getBooking: vi.fn(
      (_id: string, _call: unknown): Promise<ServiceResult<unknown>> =>
        Promise.resolve({ ok: true, value: confirmedBooking() }),
    ),
  };
  const payment = {
    capture: vi.fn(
      (_request: unknown, _call: unknown): Promise<ServiceResult<unknown>> =>
        Promise.resolve({ ok: true, value: captured }),
    ),
  };
  const service = new PickupService(
    fake.dataSource,
    booking as unknown as BookingClient,
    payment as unknown as PaymentClient,
  );
  const pickup = (code = '012345', caller = renter, at = now) =>
    service.pickup(caller, RENTAL_ID, code, call, at);
  return { fake, booking, payment, pickup };
}

describe('PickupService', () => {
  it('rechecks the booking, captures the fee and makes the rental ACTIVE', async () => {
    const { fake, booking, payment, pickup } = setup(
      rentalRow({ pickup_attempts: 3 }),
    );
    const rental = await pickup();
    expect(booking.getBooking).toHaveBeenCalledWith(BOOKING_ID, call);
    expect(payment.capture).toHaveBeenCalledWith(
      {
        operationId: `rental:${RENTAL_ID}:capture-fee`,
        bookingId: BOOKING_ID,
        amount: 6000,
      },
      call,
    );
    expect(fake.row).toMatchObject({
      status: 'ACTIVE',
      picked_up_at: now,
      pickup_attempts: 0,
      last_error: null,
    });
    expect(rental).toMatchObject({
      status: 'ACTIVE',
      pickedUpAt: now.toISOString(),
      pickupCode: '',
      returnCode: '987654',
    });
  });

  it('announces rental.started to the owner and the renter', async () => {
    const { fake, pickup } = setup();
    await pickup();
    expect(fake.events()).toEqual([
      expect.objectContaining({
        type: 'rental.started',
        producer: 'rental',
        recipients: [OWNER_ID, RENTER_ID],
        correlationId: 'corr-1',
        data: expect.objectContaining({
          rentalId: RENTAL_ID,
          status: 'ACTIVE',
          lateFee: 0,
        }) as unknown,
      }),
    ]);
  });

  it('makes the transition conditional on AWAITING_PICKUP', async () => {
    const { fake, pickup } = setup();
    await pickup();
    expect(fake.updates().at(-1)).toContain(
      "WHERE id = $1 AND status = 'AWAITING_PICKUP'",
    );
  });

  describe('who may pick up', () => {
    it.each([
      ['someone who does not take part', stranger],
      ['an unknown rental', renter],
    ])('answers 404 to %s', async (label, caller) => {
      const { booking, pickup } = setup(
        label === 'an unknown rental' ? null : rentalRow(),
      );
      const err = await errorOf(pickup('012345', caller));
      expect(err).toBeInstanceOf(NotFoundException);
      expect(booking.getBooking).not.toHaveBeenCalled();
    });

    it('answers 403 to the owner', async () => {
      const { fake, pickup } = setup();
      const err = await errorOf(pickup('012345', owner));
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as Error).message).toBe(
        'Only the renter can confirm the pickup',
      );
      expect(fake.row?.pickup_attempts).toBe(0);
    });

    it('accepts the renter ID in another case', async () => {
      const { pickup } = setup();
      const rental = await pickup('012345', {
        ...renter,
        sub: RENTER_ID.toUpperCase(),
      });
      expect(rental.status).toBe('ACTIVE');
    });
  });

  it.each(['ACTIVE', 'SETTLEMENT_PENDING', 'CLOSED'] as const)(
    'answers 409 when the rental is %s',
    async (status) => {
      const { booking, pickup } = setup(rentalRow({ status }));
      const err = await errorOf(pickup());
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe('The item was already picked up');
      expect(booking.getBooking).not.toHaveBeenCalled();
    },
  );

  it('answers 409 for a CANCELLED rental without checking the code', async () => {
    const { fake, booking, payment, pickup } = setup(
      rentalRow({ status: 'CANCELLED' }),
    );
    const err = await errorOf(pickup('000000'));
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe(
      'The booking was cancelled, so there is no pickup',
    );
    expect(fake.row?.pickup_attempts).toBe(0);
    expect(booking.getBooking).not.toHaveBeenCalled();
    expect(payment.capture).not.toHaveBeenCalled();
  });

  it.each([
    ['too early', '2026-10-31T16:59:59.999Z'],
    ['after the end', '2026-11-04T17:00:00.000Z'],
  ])('answers 409 %s and does not count the code', async (_label, time) => {
    const { fake, booking, pickup } = setup();
    const err = await errorOf(pickup('000000', renter, new Date(time)));
    expect(err).toBeInstanceOf(ConflictException);
    expect(fake.row?.pickup_attempts).toBe(0);
    expect(booking.getBooking).not.toHaveBeenCalled();
  });

  describe('wrong code', () => {
    it('answers 400 and keeps the counted attempt', async () => {
      const { fake, booking, payment, pickup } = setup();
      const err = await errorOf(pickup('000000'));
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toBe('Wrong pickup code');
      expect(fake.row).toMatchObject({
        status: 'AWAITING_PICKUP',
        pickup_attempts: 1,
        pickup_code: '012345',
      });
      expect(booking.getBooking).not.toHaveBeenCalled();
      expect(payment.capture).not.toHaveBeenCalled();
      expect(fake.events()).toEqual([]);
    });

    it('replaces the code at the fifth wrong attempt', async () => {
      const { fake, pickup } = setup();
      for (let attempt = 1; attempt <= 5; attempt++) {
        await expect(pickup('000000')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
      expect(fake.row?.pickup_attempts).toBe(0);
      expect(fake.row?.pickup_code).toMatch(/^[0-9]{6}$/);
      expect(fake.row?.return_code).toBe('987654');
    });
  });

  describe('booking recheck', () => {
    it.each([
      [
        'not confirmed',
        confirmedBooking({ status: 'CANCELLED' }),
        'The booking is not confirmed',
      ],
      [
        'for another period',
        confirmedBooking({
          period: {
            start: '2026-11-02T17:00:00Z',
            end: '2026-11-04T17:00:00Z',
          },
        }),
        'The booking does not match the rental',
      ],
    ])('answers 409 when the booking is %s', async (_label, value, message) => {
      const { fake, booking, payment, pickup } = setup();
      booking.getBooking.mockResolvedValueOnce({ ok: true, value });
      const err = await errorOf(pickup());
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(message);
      expect(payment.capture).not.toHaveBeenCalled();
      expect(fake.row).toMatchObject({
        status: 'AWAITING_PICKUP',
        pickup_code: '012345',
        last_error: message,
      });
    });

    it('answers 409 when Booking refuses', async () => {
      const { fake, booking, pickup } = setup();
      booking.getBooking.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'Booking not found',
      });
      const err = await errorOf(pickup());
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(
        'Booking check was declined: Booking not found',
      );
      expect(fake.row?.status).toBe('AWAITING_PICKUP');
    });

    it('answers 503 when Booking is unavailable', async () => {
      const { fake, booking, pickup } = setup();
      booking.getBooking.mockResolvedValueOnce({
        ok: false,
        reason: 'unavailable',
        message: 'The booking service is unavailable',
      });
      const err = await errorOf(pickup());
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(fake.row?.last_error).toBe(
        'Booking check is unavailable: The booking service is unavailable',
      );
    });
  });

  describe('fee capture', () => {
    it('answers 409 with the Payment message and stays AWAITING_PICKUP', async () => {
      const { fake, payment, pickup } = setup();
      payment.capture.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'The fee authorization has expired',
      });
      const err = await errorOf(pickup());
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(
        'Fee capture was declined: The fee authorization has expired',
      );
      expect(fake.row).toMatchObject({
        status: 'AWAITING_PICKUP',
        pickup_code: '012345',
        picked_up_at: null,
        last_error:
          'Fee capture was declined: The fee authorization has expired',
      });
      expect(fake.events()).toEqual([]);
    });

    it('answers 503 when Payment is unavailable, and a retry then succeeds', async () => {
      const { fake, payment, pickup } = setup();
      payment.capture.mockResolvedValueOnce({
        ok: false,
        reason: 'unavailable',
        message: 'The payment service is unavailable',
      });
      await expect(pickup()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fake.row?.status).toBe('AWAITING_PICKUP');
      expect(fake.events()).toEqual([]);
      const rental = await pickup();
      expect(rental).toMatchObject({ status: 'ACTIVE', lastError: '' });
      expect(payment.capture.mock.calls[1][0]).toEqual(
        payment.capture.mock.calls[0][0],
      );
    });
  });

  it('returns the rental made ACTIVE by a concurrent pickup', async () => {
    const { fake, payment, pickup } = setup();
    const earlier = new Date('2026-11-01T09:59:59Z');
    payment.capture.mockImplementationOnce(() => {
      fake.set({
        ...(fake.row as RentalRow),
        status: 'ACTIVE',
        picked_up_at: earlier,
      });
      return Promise.resolve({ ok: true, value: captured });
    });
    const rental = await pickup();
    expect(rental).toMatchObject({
      status: 'ACTIVE',
      pickedUpAt: earlier.toISOString(),
    });
    expect(fake.events()).toEqual([]);
  });

  it('answers 409 when a cancel ended the rental after the claim lapsed', async () => {
    const { fake, payment, pickup } = setup();
    payment.capture.mockImplementationOnce(() => {
      fake.set({ ...(fake.row as RentalRow), status: 'CANCELLED' });
      return Promise.resolve({ ok: true, value: captured });
    });
    expect(await errorOf(pickup())).toBeInstanceOf(ConflictException);
    expect(fake.row?.status).toBe('CANCELLED');
    expect(fake.events()).toEqual([]);
  });

  describe('pickup claim', () => {
    it('claims the rental before the booking check and the capture, and clears it on activation', async () => {
      const { fake, booking, payment, pickup } = setup();
      const claimedAt: (Date | null | undefined)[] = [];
      booking.getBooking.mockImplementationOnce(() => {
        claimedAt.push(fake.row?.pickup_claimed_at);
        return Promise.resolve({ ok: true, value: confirmedBooking() });
      });
      payment.capture.mockImplementationOnce(() => {
        claimedAt.push(fake.row?.pickup_claimed_at);
        return Promise.resolve({ ok: true, value: captured });
      });
      await pickup();
      expect(claimedAt).toEqual([now, now]);
      expect(fake.row).toMatchObject({
        status: 'ACTIVE',
        pickup_claimed_at: null,
      });
    });

    it('keeps a cancellation out while the fee is captured', async () => {
      const { fake, payment, pickup } = setup();
      const cancellation = new RentalCancellationService(fake.dataSource);
      let cancelError: unknown;
      payment.capture.mockImplementationOnce(async () => {
        cancelError = await errorOf(
          cancellation.cancelByBooking(BOOKING_ID, now),
        );
        return { ok: true, value: captured };
      });
      expect((await pickup()).status).toBe('ACTIVE');
      expect(cancelError).toBeInstanceOf(ConflictException);
      expect(fake.row?.status).toBe('ACTIVE');
    });

    it('refuses a second pickup while a fresh claim exists, without counting the code', async () => {
      const claimed = new Date(now.getTime() - 60_000);
      const { fake, booking, pickup } = setup(
        rentalRow({ pickup_claimed_at: claimed }),
      );
      const err = await errorOf(pickup('000000'));
      expect(err).toBeInstanceOf(ConflictException);
      expect(fake.row).toMatchObject({
        pickup_attempts: 0,
        pickup_claimed_at: claimed,
      });
      expect(booking.getBooking).not.toHaveBeenCalled();
    });

    it('takes over a claim older than the lease', async () => {
      const lapsed = new Date(now.getTime() - PICKUP_CLAIM_LEASE_MS);
      const { fake, pickup } = setup(rentalRow({ pickup_claimed_at: lapsed }));
      expect((await pickup()).status).toBe('ACTIVE');
      expect(fake.updates()).toContainEqual(
        expect.stringContaining('pickup_claimed_at <= $3'),
      );
    });

    it.each([
      [
        'the capture fails',
        (s: ReturnType<typeof setup>) =>
          s.payment.capture.mockResolvedValueOnce({
            ok: false,
            reason: 'unavailable',
            message: 'The payment service is unavailable',
          }),
      ],
      [
        'Booking refuses',
        (s: ReturnType<typeof setup>) =>
          s.booking.getBooking.mockResolvedValueOnce({
            ok: true,
            value: confirmedBooking({ status: 'CANCELLED' }),
          }),
      ],
    ])(
      'clears the claim when %s, so the booking can be cancelled',
      async (_label, fail) => {
        const s = setup();
        fail(s);
        await expect(s.pickup()).rejects.toBeDefined();
        expect(s.fake.row).toMatchObject({
          status: 'AWAITING_PICKUP',
          pickup_claimed_at: null,
        });
        const cancellation = new RentalCancellationService(s.fake.dataSource);
        await expect(
          cancellation.cancelByBooking(BOOKING_ID, now),
        ).resolves.toMatchObject({ status: 'CANCELLED' });
      },
    );
  });
});
