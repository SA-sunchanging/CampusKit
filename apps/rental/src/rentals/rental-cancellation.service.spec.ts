import { ConflictException, NotFoundException } from '@nestjs/common';
import { FakeRentalDb } from '../testing/fake-rental-db.js';
import {
  BOOKING_ID,
  errorOf,
  NOW,
  RENTAL_ID,
  rentalRow,
} from '../testing/fixtures.js';
import { PICKUP_CLAIM_LEASE_MS } from './pickup-claim.js';
import { RentalCancellationService } from './rental-cancellation.service.js';
import type { RentalRow } from './rental.row.js';

function setup(row: RentalRow | null = rentalRow()) {
  const fake = new FakeRentalDb(row ?? undefined);
  const service = new RentalCancellationService(fake.dataSource);
  return { fake, service };
}

describe('RentalCancellationService', () => {
  it('cancels a rental awaiting pickup, conditionally and without an event', async () => {
    const { fake, service } = setup();
    const rental = await service.cancelByBooking(BOOKING_ID);
    expect(rental).toMatchObject({
      id: RENTAL_ID,
      bookingId: BOOKING_ID,
      status: 'CANCELLED',
    });
    expect(fake.row?.status).toBe('CANCELLED');
    expect(fake.updates()).toEqual([
      expect.stringContaining("WHERE id = $1 AND status = 'AWAITING_PICKUP'"),
    ]);
    expect(fake.events()).toEqual([]);
  });

  it('locks the rental of the booking before deciding', async () => {
    const { fake, service } = setup();
    await service.cancelByBooking(BOOKING_ID);
    expect(fake.statements[0].sql).toContain(
      'WHERE booking_id = $1 FOR UPDATE',
    );
    expect(fake.statements[0].params).toEqual([BOOKING_ID]);
  });

  it('returns a CANCELLED rental unchanged when Booking repeats the call', async () => {
    const { fake, service } = setup(rentalRow({ status: 'CANCELLED' }));
    const rental = await service.cancelByBooking(BOOKING_ID);
    expect(rental.status).toBe('CANCELLED');
    expect(fake.updates()).toEqual([]);
  });

  it('answers 409 and changes nothing while a pickup holds a fresh claim', async () => {
    const claimed = new Date(NOW.getTime() - 60_000);
    const { fake, service } = setup(rentalRow({ pickup_claimed_at: claimed }));
    const err = await errorOf(service.cancelByBooking(BOOKING_ID, NOW));
    expect(err).toBeInstanceOf(ConflictException);
    expect(fake.row).toMatchObject({
      status: 'AWAITING_PICKUP',
      pickup_claimed_at: claimed,
    });
    expect(fake.updates()).toEqual([]);
  });

  it('cancels once the claim is older than the lease', async () => {
    const lapsed = new Date(NOW.getTime() - PICKUP_CLAIM_LEASE_MS);
    const { fake, service } = setup(rentalRow({ pickup_claimed_at: lapsed }));
    await service.cancelByBooking(BOOKING_ID, NOW);
    expect(fake.row?.status).toBe('CANCELLED');
    const [update] = fake.statements.filter(({ sql }) =>
      sql.includes("SET status = 'CANCELLED'"),
    );
    expect(update.sql).toContain('pickup_claimed_at <= $2');
    expect(update.params).toEqual([RENTAL_ID, lapsed]);
  });

  it('answers 404 when the booking has no rental', async () => {
    const { service } = setup(null);
    expect(await errorOf(service.cancelByBooking(BOOKING_ID))).toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['ACTIVE', 'SETTLEMENT_PENDING', 'CLOSED'] as const)(
    'answers 409 when the rental is %s',
    async (status) => {
      const { fake, service } = setup(rentalRow({ status }));
      const err = await errorOf(service.cancelByBooking(BOOKING_ID));
      expect(err).toBeInstanceOf(ConflictException);
      expect(fake.row?.status).toBe(status);
      expect(fake.updates()).toEqual([]);
    },
  );
});
