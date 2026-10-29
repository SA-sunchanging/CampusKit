import type { PaymentClient } from '../clients/payment.client.js';
import type { RentalClient } from '../clients/rental.client.js';
import { authorizeAndCreateRental } from './approval.js';
import type { BookingRow } from './booking.row.js';

const call = { correlationId: 'corr-1' };
const booking = {
  id: 'b1',
  listing_id: 'l1',
  owner_id: 'owner-1',
  renter_id: 'renter-1',
  status: 'AUTHORIZING',
  period_start: new Date('2026-11-01T17:00:00Z'),
  period_end: new Date('2026-11-04T17:00:00Z'),
  rental_fee: 6000,
  deposit: 30000,
  late_fee_per_day: 4000,
} as BookingRow;
const unavailable = {
  ok: false as const,
  reason: 'unavailable' as const,
  message: 'The payment service is unavailable',
};

function setup() {
  const payment = {
    authorize: vi.fn().mockResolvedValue({
      ok: true,
      value: { id: 'a', status: 'AUTHORIZED' },
    }),
  };
  const rental = {
    create: vi.fn().mockResolvedValue({ ok: true, value: { id: 'rental-1' } }),
  };
  const run = (row: BookingRow = booking) =>
    authorizeAndCreateRental(
      payment as unknown as PaymentClient,
      rental as unknown as RentalClient,
      row,
      call,
    );
  return { payment, rental, run };
}

describe('authorizeAndCreateRental', () => {
  it('authorizes the fee, then the deposit, then creates the rental', async () => {
    const { payment, rental, run } = setup();
    await expect(run()).resolves.toEqual({ ok: true, rentalId: 'rental-1' });
    expect(payment.authorize.mock.calls.map(([request]) => request)).toEqual([
      {
        operationId: 'booking:b1:authorize-fee',
        bookingId: 'b1',
        payerId: 'renter-1',
        payeeId: 'owner-1',
        kind: 'FEE',
        amount: 6000,
      },
      {
        operationId: 'booking:b1:authorize-deposit',
        bookingId: 'b1',
        payerId: 'renter-1',
        payeeId: 'owner-1',
        kind: 'DEPOSIT',
        amount: 30000,
      },
    ]);
    expect(rental.create).toHaveBeenCalledWith(
      {
        bookingId: 'b1',
        listingId: 'l1',
        ownerId: 'owner-1',
        renterId: 'renter-1',
        period: {
          start: '2026-11-01T17:00:00.000Z',
          end: '2026-11-04T17:00:00.000Z',
        },
        terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
      },
      call,
    );
  });

  it('stops when the fee is not authorized', async () => {
    const { payment, rental, run } = setup();
    payment.authorize.mockResolvedValueOnce(unavailable);
    await expect(run()).resolves.toEqual({
      ok: false,
      error:
        'Fee authorization is unavailable: The payment service is unavailable',
    });
    expect(payment.authorize).toHaveBeenCalledTimes(1);
    expect(rental.create).not.toHaveBeenCalled();
  });

  it('describes a declined deposit', async () => {
    const { payment, run } = setup();
    payment.authorize
      .mockResolvedValueOnce({ ok: true, value: { id: 'a', status: 'OK' } })
      .mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'Insufficient balance',
      });
    await expect(run()).resolves.toEqual({
      ok: false,
      error: 'Deposit authorization was declined: Insufficient balance',
    });
  });

  it('reports a failed rental creation', async () => {
    const { rental, run } = setup();
    rental.create.mockResolvedValueOnce({
      ...unavailable,
      message: 'The rental service is unavailable',
    });
    await expect(run()).resolves.toMatchObject({ ok: false });
  });

  it('skips a zero deposit', async () => {
    const { payment, run } = setup();
    await run({ ...booking, deposit: 0 });
    expect(payment.authorize).toHaveBeenCalledTimes(1);
  });
});
