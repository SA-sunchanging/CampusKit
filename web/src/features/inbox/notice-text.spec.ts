import { describe, expect, it } from 'vitest';
import { formatBaht, formatDateRange } from '../../ui/format.ts';
import { describeNotice } from './notice-text.ts';

const OWNER = 'owner-1';
const RENTER = 'renter-1';
const START = '2026-10-31T17:00:00Z';
const END = '2026-11-02T17:00:00Z';
const RANGE = formatDateRange(START, END);

const booking = {
  bookingId: 'b-1',
  listingId: 'l-1',
  ownerId: OWNER,
  renterId: RENTER,
  period: { start: START, end: END },
  status: 'CONFIRMED',
};

const rental = {
  rentalId: 'r-1',
  bookingId: 'b-1',
  listingId: 'l-1',
  ownerId: OWNER,
  renterId: RENTER,
  period: { start: START, end: END },
  status: 'CLOSED',
  lateFee: 0,
};

const notice = (type: string, data: Record<string, unknown>, viewer: string) =>
  describeNotice({ type, data }, viewer);

describe('describeNotice for booking events', () => {
  it('tells the owner about a new request', () => {
    const text = notice('booking.requested', booking, OWNER);
    expect(text.title).toBe('New booking request');
    expect(text.body).toContain(RANGE);
    expect(text.link).toBe('/bookings');
  });

  it('tells the renter that the owner declined', () => {
    const text = notice('booking.declined', booking, RENTER);
    expect(text.title).toBe('Booking declined');
    expect(text.body).toBe(`The owner declined your request for ${RANGE}.`);
    expect(text.link).toBe('/bookings');
  });

  it('words a confirmed booking for each side', () => {
    const owner = notice('booking.confirmed', booking, OWNER);
    const renter = notice('booking.confirmed', booking, RENTER);
    expect(owner.title).toBe('Booking confirmed');
    expect(owner.body).toMatch(/^You approved a booking for /);
    expect(renter.body).toMatch(/^The owner approved your booking for /);
    expect(owner.body).toContain(RANGE);
    expect(renter.body).toContain(RANGE);
    expect(owner.link).toBe('/rentals');
    expect(renter.link).toBe('/rentals');
  });

  it('words a failed booking for each side', () => {
    const owner = notice('booking.failed', booking, OWNER);
    const renter = notice('booking.failed', booking, RENTER);
    expect(owner.title).toBe('Booking not completed');
    expect(owner.body).toMatch(/^Your approval of the booking for /);
    expect(renter.body).toMatch(/^Your booking for /);
    expect(renter.body).toContain('request the item again');
    expect(owner.link).toBe('/bookings');
    expect(renter.link).toBe('/bookings');
  });

  it('words an expired request for each side', () => {
    const owner = notice('booking.expired', booking, OWNER);
    const renter = notice('booking.expired', booking, RENTER);
    expect(owner.title).toBe('Booking request expired');
    expect(owner.body).toMatch(/^A request for .* expired before you answered/);
    expect(renter.body).toContain('request the item again');
    expect(renter.link).toBe('/bookings');
  });

  it('words a cancelled booking with and without a reason', () => {
    const plain = notice('booking.cancelled', booking, OWNER);
    expect(plain.title).toBe('Booking cancelled');
    expect(plain.body).toBe(
      `The booking for ${RANGE} was cancelled before pickup, so the dates are free again.`,
    );
    const withReason = { ...booking, reason: 'Plans changed' };
    expect(notice('booking.cancelled', withReason, RENTER).body).toMatch(
      / Reason: Plans changed$/,
    );
  });
});

describe('describeNotice for listing events', () => {
  it('names the published listing and links to it', () => {
    const text = notice(
      'listing.published',
      {
        listingId: 'l 1',
        ownerId: OWNER,
        title: 'Racket',
        status: 'PUBLISHED',
      },
      OWNER,
    );
    expect(text.title).toBe('Listing published');
    expect(text.body).toBe('"Racket" is now open for booking.');
    expect(text.link).toBe('/listings/l%201');
  });

  it('works without a title or a listing ID', () => {
    const text = notice('listing.published', {}, OWNER);
    expect(text.body).toBe('Your listing is now open for booking.');
    expect(text.link).toBeUndefined();
  });

  it('names a rejected listing and gives the reason', () => {
    const text = notice(
      'listing.rejected',
      {
        listingId: 'l-1',
        ownerId: OWNER,
        title: 'Camera',
        status: 'REJECTED',
        reason: 'Photos missing',
      },
      OWNER,
    );
    expect(text.title).toBe('Listing not approved');
    expect(text.body).toBe(
      'An administrator did not approve "Camera", so it is not published. Reason: Photos missing',
    );
    expect(text.link).toBe('/listings/l-1');
  });
});

describe('describeNotice for identity events', () => {
  it('tells the student their status is verified', () => {
    const text = notice(
      'identity.verified',
      { userId: RENTER, studentStatus: 'VERIFIED' },
      RENTER,
    );
    expect(text.title).toBe('Student status verified');
    expect(text.link).toBe('/account');
  });
});

describe('describeNotice for rental events', () => {
  it('words a started rental for each side and links to it', () => {
    const owner = notice('rental.started', rental, OWNER);
    const renter = notice('rental.started', rental, RENTER);
    expect(owner.title).toBe('Rental started');
    expect(owner.body).toBe(`The renter picked up your item for ${RANGE}.`);
    expect(renter.body).toMatch(/^You picked up the item for /);
    expect(owner.link).toBe('/rentals/r-1');
    expect(renter.link).toBe('/rentals/r-1');
  });

  it('words a closed rental for each side, without a fee when none is due', () => {
    const owner = notice('rental.closed', rental, OWNER);
    const renter = notice('rental.closed', rental, RENTER);
    expect(owner.title).toBe('Rental closed');
    expect(owner.body).toBe(
      `Your item is back and the rental for ${RANGE} is settled.`,
    );
    expect(renter.body).toBe(
      `You returned the item and the rental for ${RANGE} is settled.`,
    );
    expect(owner.link).toBe('/rentals/r-1');
  });

  it('mentions a late fee above zero', () => {
    const late = { ...rental, lateFee: 5000 };
    expect(notice('rental.closed', late, OWNER).body).toContain(
      `A late fee of ${formatBaht(5000)} was taken from the deposit.`,
    );
    expect(notice('rental.closed', late, RENTER).body).toContain(
      formatBaht(5000),
    );
  });

  it('reminds the renter before the period ends', () => {
    const text = notice('rental.reminded', rental, RENTER);
    expect(text.title).toBe('Return due soon');
    expect(text.body).toContain(RANGE);
    expect(text.link).toBe('/rentals/r-1');
  });

  it('words an overdue rental for each side', () => {
    const owner = notice('rental.overdue', rental, OWNER);
    const renter = notice('rental.overdue', rental, RENTER);
    expect(owner.title).toBe('Rental overdue');
    expect(owner.body).toContain('your item is not back yet');
    expect(renter.body).toContain('Return the item now');
  });

  it('falls back to the rentals page without a rental ID', () => {
    const { rentalId: _unused, ...noId } = rental;
    expect(notice('rental.started', noId, RENTER).link).toBe('/rentals');
  });
});

describe('describeNotice with unexpected input', () => {
  it('gives a generic notice for an unknown type', () => {
    expect(notice('payment.refunded', {}, RENTER)).toEqual({
      title: 'Update',
      body: 'Something changed (payment.refunded).',
    });
  });

  it('does not treat built-in object keys as types', () => {
    expect(notice('constructor', {}, RENTER).title).toBe('Update');
    expect(notice('', {}, RENTER).body).toBe('Something changed.');
  });

  it('leaves out a missing or invalid period', () => {
    const noPeriod = { ...booking, period: undefined };
    const badPeriod = { ...booking, period: { start: 'soon', end: 3 } };
    expect(notice('booking.declined', noPeriod, RENTER).body).toBe(
      'The owner declined your request.',
    );
    expect(notice('booking.declined', badPeriod, RENTER).body).toBe(
      'The owner declined your request.',
    );
  });

  it('treats the viewer as the renter when the owner is missing', () => {
    const { ownerId: _unused, ...noOwner } = booking;
    expect(notice('booking.confirmed', noOwner, '').body).toMatch(
      /^The owner approved/,
    );
  });

  it('ignores a late fee that is not a positive number', () => {
    const odd = { ...rental, lateFee: '5000' };
    expect(notice('rental.closed', odd, OWNER).body).not.toContain('late fee');
    expect(
      notice('rental.closed', { ...rental, lateFee: -1 }, OWNER).body,
    ).not.toContain('late fee');
  });

  it('copes with data that is not an object', () => {
    const entry = { type: 'booking.requested', data: null } as unknown as {
      type: string;
      data: Record<string, unknown>;
    };
    expect(describeNotice(entry, OWNER).body).toBe(
      'A student asked to rent your item. Approve or decline it in Bookings.',
    );
  });
});
