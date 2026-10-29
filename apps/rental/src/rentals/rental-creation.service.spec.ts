import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  BOOKING_ID,
  errorOf,
  LISTING_ID,
  OWNER_ID,
  RENTER_ID,
  rentalRow,
} from '../testing/fixtures.js';
import {
  type CreateRentalRequest,
  RentalCreationService,
} from './rental-creation.service.js';
import type { RentalRow } from './rental.row.js';

const request: CreateRentalRequest = {
  bookingId: BOOKING_ID,
  listingId: LISTING_ID,
  ownerId: OWNER_ID,
  renterId: RENTER_ID,
  period: { start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' },
  terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
};

/**
 * A fake rental_db: the INSERT stores a row unless one exists for the booking (ON CONFLICT DO
 * NOTHING); the SELECT by booking returns the stored row.
 */
function setup(existing?: RentalRow) {
  const rows: RentalRow[] = existing ? [existing] : [];
  const query = vi.fn((sql: string, params: unknown[] = []) => {
    if (sql.includes('INSERT INTO rentals')) {
      if (rows.some((row) => row.booking_id === params[0])) {
        return Promise.resolve([]);
      }
      const row = rentalRow({
        id: `rental-${rows.length + 1}`,
        booking_id: params[0] as string,
        listing_id: params[1] as string,
        owner_id: params[2] as string,
        renter_id: params[3] as string,
        period_start: params[4] as Date,
        period_end: params[5] as Date,
        rental_fee: params[6] as number,
        deposit: params[7] as number,
        late_fee_per_day: params[8] as number,
        pickup_code: params[9] as string,
        return_code: params[10] as string,
      });
      rows.push(row);
      return Promise.resolve([row]);
    }
    if (sql.includes('FROM rentals WHERE booking_id')) {
      return Promise.resolve(
        rows.filter((row) => row.booking_id === params[0]),
      );
    }
    return Promise.reject(new Error(`Unexpected SQL: ${sql}`));
  });
  const service = new RentalCreationService({
    query,
  } as unknown as DataSource);
  return { rows, query, service };
}

describe('RentalCreationService', () => {
  it('opens an AWAITING_PICKUP rental with two six-digit codes', async () => {
    const { service, rows, query } = setup();
    await expect(service.create(request)).resolves.toEqual({
      id: 'rental-1',
      bookingId: BOOKING_ID,
      status: 'AWAITING_PICKUP',
    });
    expect(query.mock.calls[0][0]).toContain(
      'ON CONFLICT (booking_id) DO NOTHING',
    );
    expect(rows[0]).toMatchObject({
      listing_id: LISTING_ID,
      owner_id: OWNER_ID,
      renter_id: RENTER_ID,
      period_start: new Date('2026-11-01T17:00:00Z'),
      period_end: new Date('2026-11-04T17:00:00Z'),
      rental_fee: 6000,
      deposit: 30000,
      late_fee_per_day: 4000,
    });
    expect(rows[0].pickup_code).toMatch(/^[0-9]{6}$/);
    expect(rows[0].return_code).toMatch(/^[0-9]{6}$/);
  });

  it('returns the existing rental when the same booking is sent again', async () => {
    const { service, rows } = setup();
    const first = await service.create(request);
    await expect(service.create({ ...request })).resolves.toEqual(first);
    expect(rows).toHaveLength(1);
  });

  it('compares the period as instants and UUIDs without case', async () => {
    const { service } = setup(rentalRow({ id: 'kept' }));
    const reply = await service.create({
      ...request,
      ownerId: OWNER_ID.toUpperCase(),
      period: {
        start: '2026-11-02T00:00:00+07:00',
        end: '2026-11-04T17:00:00.000Z',
      },
    });
    expect(reply.id).toBe('kept');
  });

  it.each<[string, Partial<CreateRentalRequest>]>([
    ['listing', { listingId: '44444444-4444-4444-8444-444444444444' }],
    ['owner', { ownerId: '00000000-0000-4000-8000-000000000003' }],
    ['renter', { renterId: '00000000-0000-4000-8000-000000000003' }],
    [
      'period start',
      { period: { ...request.period, start: '2026-11-01T18:00:00Z' } },
    ],
    [
      'period end',
      { period: { ...request.period, end: '2026-11-05T17:00:00Z' } },
    ],
    ['rental fee', { terms: { ...request.terms, rentalFee: 6001 } }],
    ['deposit', { terms: { ...request.terms, deposit: 0 } }],
    ['late fee per day', { terms: { ...request.terms, lateFeePerDay: 1 } }],
  ])('answers 409 when the %s differs', async (_label, change) => {
    const { service, rows } = setup(rentalRow());
    const err = await errorOf(service.create({ ...request, ...change }));
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe(
      'The booking already has a rental with other details',
    );
    expect(rows).toHaveLength(1);
  });

  it.each([
    ['ends when it starts', request.period.start],
    ['ends before it starts', '2026-11-01T16:59:59Z'],
  ])('refuses a period that %s', async (_label, end) => {
    const { service, query } = setup();
    const err = await errorOf(
      service.create({ ...request, period: { ...request.period, end } }),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses an owner who is also the renter', async () => {
    const { service, query } = setup();
    const err = await errorOf(
      service.create({ ...request, renterId: OWNER_ID.toUpperCase() }),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
