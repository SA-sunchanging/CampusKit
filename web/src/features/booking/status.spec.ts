import { describe, expect, it } from 'vitest';
import { BOOKING_STATUSES, type BookingStatus } from '../../api/booking.ts';
import {
  canCancel,
  failureHint,
  ownerAction,
  STATUS_LABELS,
  STATUS_TONES,
  statusLabel,
  statusTone,
} from './status.ts';

const NOW = new Date('2026-10-29T05:00:00Z');
const period = {
  start: '2026-10-31T17:00:00.000Z',
  end: '2026-11-03T17:00:00.000Z',
};
const booking = (status: BookingStatus, start = period.start) => ({
  status,
  period: { ...period, start },
});

describe('failureHint', () => {
  const failureReason = 'AUTHORIZATION_EXPIRES_BEFORE_RETURN';

  it('explains an expiry failure with earlier dates and a new request', () => {
    const hint = failureHint({ status: 'FAILED', failureReason });
    expect(hint).toContain('earlier dates');
    expect(hint).toContain('new booking request');
  });

  it.each([undefined, '', 'UNKNOWN_FAILURE', 'Internal database credentials'])(
    'suppresses absent or unknown failure reason %s',
    (reason) => {
      expect(
        failureHint({ status: 'FAILED', failureReason: reason }),
      ).toBeNull();
    },
  );

  it.each(BOOKING_STATUSES.filter((status) => status !== 'FAILED'))(
    'suppresses the hint on %s bookings',
    (status) => {
      expect(failureHint({ status, failureReason })).toBeNull();
    },
  );
});

describe('status labels', () => {
  it('has a label and a tone for every status', () => {
    for (const status of BOOKING_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_TONES[status]).toBeTruthy();
    }
  });

  it('shows confirmed as success and declined as danger', () => {
    expect(statusTone('CONFIRMED')).toBe('success');
    expect(statusTone('DECLINED')).toBe('danger');
    expect(statusLabel('PENDING')).toBe('Waiting for owner');
  });

  it('shows an unknown status as its code in neutral', () => {
    expect(statusLabel('ON_HOLD')).toBe('ON_HOLD');
    expect(statusTone('ON_HOLD')).toBe('neutral');
    expect(statusLabel('toString')).toBe('toString');
  });
});

describe('ownerAction', () => {
  it('lets the owner decide a pending request', () => {
    expect(ownerAction(booking('PENDING'), 'owner', NOW)).toBe('decide');
  });

  it('lets the owner retry authorization before the period starts', () => {
    expect(ownerAction(booking('AUTHORIZING'), 'owner', NOW)).toBe('retry');
  });

  it('offers no retry once the period has started', () => {
    expect(
      ownerAction(
        booking('AUTHORIZING', '2026-10-28T17:00:00.000Z'),
        'owner',
        NOW,
      ),
    ).toBeNull();
  });

  it.each(['CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED'] as const)(
    'offers nothing on %s',
    (status) => {
      expect(ownerAction(booking(status), 'owner', NOW)).toBeNull();
    },
  );

  it('offers the renter nothing', () => {
    expect(ownerAction(booking('PENDING'), 'renter', NOW)).toBeNull();
  });
});

describe('canCancel', () => {
  const later = '2026-10-30T05:00:00.000Z';

  it('allows a pending request until it expires', () => {
    expect(canCancel({ status: 'PENDING', expiresAt: later }, NOW)).toBe(true);
    expect(
      canCancel({ status: 'PENDING', expiresAt: NOW.toISOString() }, NOW),
    ).toBe(false);
  });

  it('allows a confirmed booking', () => {
    expect(canCancel({ status: 'CONFIRMED', expiresAt: later }, NOW)).toBe(
      true,
    );
  });

  it.each([
    'AUTHORIZING',
    'DECLINED',
    'EXPIRED',
    'CANCELLED',
    'FAILED',
  ] as const)('refuses %s', (status) => {
    expect(canCancel({ status, expiresAt: later }, NOW)).toBe(false);
  });
});
