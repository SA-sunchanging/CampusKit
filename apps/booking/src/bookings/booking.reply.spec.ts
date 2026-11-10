import type { BookingRow } from './booking.row.js';
import { toBookingReply } from './booking.reply.js';

const row: BookingRow = {
  id: '22222222-2222-4222-8222-222222222222',
  listing_id: '11111111-1111-4111-8111-111111111111',
  renter_id: '00000000-0000-4000-8000-000000000002',
  owner_id: '00000000-0000-4000-8000-000000000001',
  status: 'PENDING',
  period_start: new Date('2026-11-01T17:00:00Z'),
  period_end: new Date('2026-11-04T17:00:00Z'),
  rental_fee: 6000,
  deposit: 30000,
  late_fee_per_day: 4000,
  decline_reason: null,
  last_error: 'Payment is unavailable',
  rental_id: null,
  expires_at: new Date('2026-10-30T05:00:00Z'),
  created_at: new Date('2026-10-29T05:00:00Z'),
  updated_at: new Date('2026-10-29T05:00:00Z'),
};

describe('toBookingReply', () => {
  it('maps a row to the proto Booking with ISO-8601 UTC times', () => {
    expect(toBookingReply(row)).toEqual({
      id: row.id,
      listingId: row.listing_id,
      renterId: row.renter_id,
      status: 'PENDING',
      period: {
        start: '2026-11-01T17:00:00.000Z',
        end: '2026-11-04T17:00:00.000Z',
      },
      ownerId: row.owner_id,
      terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
      declineReason: '',
      expiresAt: '2026-10-30T05:00:00.000Z',
      createdAt: '2026-10-29T05:00:00.000Z',
      updatedAt: '2026-10-29T05:00:00.000Z',
      failureReason: '',
    });
  });

  it('shows the decline reason only for a declined booking', () => {
    expect(
      toBookingReply({ ...row, status: 'DECLINED', decline_reason: 'Busy' })
        .declineReason,
    ).toBe('Busy');
    expect(
      toBookingReply({ ...row, status: 'EXPIRED', decline_reason: 'Busy' })
        .declineReason,
    ).toBe('');
  });

  it.each(['Fee authorization', 'Deposit authorization'])(
    'exposes a public reason for %s expiring before return',
    (step) => {
      const result = toBookingReply({
        ...row,
        status: 'FAILED',
        last_error: `${step} was declined: The authorization must last beyond the rental return; choose earlier dates`,
      });
      expect(result.failureReason).toBe('AUTHORIZATION_EXPIRES_BEFORE_RETURN');
      expect(result).not.toHaveProperty('lastError');
      expect(result).not.toHaveProperty('last_error');
    },
  );

  it.each([
    null,
    'Payment host secret.internal:5432 failed',
    'The authorization has expired',
  ])('keeps an unknown failure private: %j', (lastError) => {
    const result = toBookingReply({
      ...row,
      status: 'FAILED',
      last_error: lastError,
    });
    expect(result.failureReason).toBe('');
    expect(result).not.toHaveProperty('lastError');
    expect(result).not.toHaveProperty('last_error');
    if (lastError) expect(JSON.stringify(result)).not.toContain(lastError);
  });

  it('does not report a failure for a booking that has not failed', () => {
    expect(
      toBookingReply({
        ...row,
        status: 'AUTHORIZING',
        last_error:
          'The authorization must last beyond the rental return; choose earlier dates',
      }).failureReason,
    ).toBe('');
  });
});
