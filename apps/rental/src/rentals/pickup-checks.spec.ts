import type { BookingView } from '../clients/booking.client.js';
import {
  confirmedBooking,
  OWNER_ID,
  rentalRow,
  STRANGER_ID,
} from '../testing/fixtures.js';
import { bookingProblem, pickupWindowError } from './pickup-checks.js';

/** The fixture period is [2026-11-01T17:00Z, 2026-11-04T17:00Z). */
const row = rentalRow();

describe('pickupWindowError', () => {
  it.each([
    ['24 hours before the start', '2026-10-31T17:00:00.000Z'],
    ['at the start', '2026-11-01T17:00:00.000Z'],
    ['just before the end', '2026-11-04T16:59:59.999Z'],
  ])('allows pickup %s', (_label, time) => {
    expect(pickupWindowError(row, new Date(time))).toBeUndefined();
  });

  it('refuses pickup earlier than 24 hours before the start', () => {
    expect(pickupWindowError(row, new Date('2026-10-31T16:59:59.999Z'))).toBe(
      'Pickup opens 24 hours before the rental period starts',
    );
  });

  it.each(['2026-11-04T17:00:00.000Z', '2026-11-05T00:00:00.000Z'])(
    'refuses pickup at or after the end (%s)',
    (time) => {
      expect(pickupWindowError(row, new Date(time))).toBe(
        'The rental period has ended, so the item can no longer be picked up',
      );
    },
  );
});

describe('bookingProblem', () => {
  it('accepts a confirmed booking with the same details', () => {
    expect(bookingProblem(row, confirmedBooking())).toBeUndefined();
  });

  it('compares times as instants and IDs without case', () => {
    expect(
      bookingProblem(
        row,
        confirmedBooking({
          ownerId: OWNER_ID.toUpperCase(),
          period: {
            start: '2026-11-02T00:00:00+07:00',
            end: '2026-11-04T17:00:00Z',
          },
        }),
      ),
    ).toBeUndefined();
  });

  it.each(['PENDING', 'AUTHORIZING', 'CANCELLED', 'EXPIRED'])(
    'refuses a %s booking',
    (status) => {
      expect(bookingProblem(row, confirmedBooking({ status }))).toBe(
        'The booking is not confirmed',
      );
    },
  );

  it.each<[string, Partial<BookingView>]>([
    ['listing', { listingId: '44444444-4444-4444-8444-444444444444' }],
    ['renter', { renterId: STRANGER_ID }],
    ['owner', { ownerId: STRANGER_ID }],
    [
      'start',
      {
        period: {
          start: '2026-11-01T18:00:00Z',
          end: '2026-11-04T17:00:00Z',
        },
      },
    ],
    [
      'end',
      {
        period: {
          start: '2026-11-01T17:00:00Z',
          end: '2026-11-05T17:00:00Z',
        },
      },
    ],
  ])('refuses a booking with another %s', (_label, change) => {
    expect(bookingProblem(row, confirmedBooking(change))).toBe(
      'The booking does not match the rental',
    );
  });
});
