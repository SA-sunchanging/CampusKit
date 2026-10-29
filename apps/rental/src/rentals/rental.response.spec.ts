import {
  OWNER_ID,
  RENTER_ID,
  rentalRow,
  STRANGER_ID,
} from '../testing/fixtures.js';
import { RENTAL_STATUSES, type RentalStatus } from './rental.entity.js';
import { RentalListResponse, RentalResponse } from './rental.response.js';

const viewers = { owner: OWNER_ID, renter: RENTER_ID, stranger: STRANGER_ID };

/** Which codes each viewer sees in each status: [pickupCode, returnCode]. */
const expected: Record<RentalStatus, Record<string, [string, string]>> = {
  AWAITING_PICKUP: {
    owner: ['012345', ''],
    renter: ['', ''],
    stranger: ['', ''],
  },
  ACTIVE: { owner: ['', ''], renter: ['', '987654'], stranger: ['', ''] },
  SETTLEMENT_PENDING: {
    owner: ['', ''],
    renter: ['', ''],
    stranger: ['', ''],
  },
  CLOSED: { owner: ['', ''], renter: ['', ''], stranger: ['', ''] },
  CANCELLED: { owner: ['', ''], renter: ['', ''], stranger: ['', ''] },
};

const cases = RENTAL_STATUSES.flatMap((status) =>
  Object.entries(viewers).map(
    ([viewer, id]) =>
      [status, viewer, id, ...expected[status][viewer]] as const,
  ),
);

describe('RentalResponse', () => {
  it.each(cases)(
    'in %s shows the %s the right codes',
    (status, _viewer, viewerId, pickupCode, returnCode) => {
      const response = RentalResponse.of(rentalRow({ status }), viewerId);
      expect(response.pickupCode).toBe(pickupCode);
      expect(response.returnCode).toBe(returnCode);
    },
  );

  it('recognizes the viewer whatever the case of the ID', () => {
    const response = RentalResponse.of(rentalRow(), OWNER_ID.toUpperCase());
    expect(response.pickupCode).toBe('012345');
  });

  it('fills every field of a new rental, with empty strings for unset times', () => {
    expect(RentalResponse.of(rentalRow(), OWNER_ID)).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      bookingId: '22222222-2222-4222-8222-222222222222',
      listingId: '33333333-3333-4333-8333-333333333333',
      ownerId: OWNER_ID,
      renterId: RENTER_ID,
      status: 'AWAITING_PICKUP',
      period: {
        start: '2026-11-01T17:00:00.000Z',
        end: '2026-11-04T17:00:00.000Z',
      },
      terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
      pickupCode: '012345',
      returnCode: '',
      pickedUpAt: '',
      returnedAt: '',
      closedAt: '',
      lateDays: 0,
      lateFee: 0,
      overdue: false,
      overdueAt: '',
      lateFeeSoFar: 0,
      lastError: '',
      createdAt: '2026-10-29T04:00:00.000Z',
      updatedAt: '2026-10-29T04:00:00.000Z',
    });
  });

  it('shows the pickup, return and settlement fields once set', () => {
    const response = RentalResponse.of(
      rentalRow({
        status: 'SETTLEMENT_PENDING',
        picked_up_at: new Date('2026-11-01T18:00:00Z'),
        returned_at: new Date('2026-11-05T18:00:00Z'),
        late_days: 2,
        late_fee: 8000,
        last_error: 'payment is unavailable',
        pickup_attempts: 3,
      }),
      RENTER_ID,
    );
    expect(response).toMatchObject({
      pickedUpAt: '2026-11-01T18:00:00.000Z',
      returnedAt: '2026-11-05T18:00:00.000Z',
      closedAt: '',
      lateDays: 2,
      lateFee: 8000,
      lastError: 'payment is unavailable',
    });
    expect(Object.keys(response)).not.toContain('pickupAttempts');
    expect(JSON.stringify(response)).not.toContain('attempts');
  });

  it('shows an overdue ACTIVE rental with its late fee so far', () => {
    const overdueAt = new Date('2026-11-04T17:00:30Z');
    const row = rentalRow({ status: 'ACTIVE', overdue_at: overdueAt });
    const now = new Date('2026-11-05T18:00:00Z');
    expect(RentalResponse.of(row, OWNER_ID, now)).toMatchObject({
      overdue: true,
      overdueAt: '2026-11-04T17:00:30.000Z',
      lateFeeSoFar: 8000,
      lateFee: 0,
    });
  });

  it('keeps when it was overdue after the return, without a fee so far', () => {
    const row = rentalRow({
      status: 'CLOSED',
      overdue_at: new Date('2026-11-04T17:00:30Z'),
      late_fee: 8000,
    });
    expect(
      RentalResponse.of(row, RENTER_ID, new Date('2026-11-09T00:00:00Z')),
    ).toMatchObject({
      overdue: false,
      overdueAt: '2026-11-04T17:00:30.000Z',
      lateFeeSoFar: 0,
      lateFee: 8000,
    });
  });

  it('works out the late fee so far at the same time for every listed rental', () => {
    const overdue = { status: 'ACTIVE' as const, overdue_at: new Date() };
    const list = RentalListResponse.of(
      [rentalRow({ id: 'a', ...overdue }), rentalRow({ id: 'b', ...overdue })],
      RENTER_ID,
      new Date('2026-11-04T17:00:00.001Z'),
    );
    expect(list.rentals.map((r) => r.lateFeeSoFar)).toEqual([4000, 4000]);
  });

  it('lists rentals for one viewer', () => {
    const list = RentalListResponse.of(
      [rentalRow({ id: 'a' }), rentalRow({ id: 'b', status: 'ACTIVE' })],
      RENTER_ID,
    );
    expect(list.rentals.map((r) => [r.id, r.returnCode])).toEqual([
      ['a', ''],
      ['b', '987654'],
    ]);
  });
});
