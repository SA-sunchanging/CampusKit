import { BadRequestException } from '@nestjs/common';
import { quoteFor } from './quote.js';

const listing = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '00000000-0000-4000-8000-000000000001',
  dailyRate: 2000,
  deposit: 30000,
  lateFeePerDay: 4000,
  maxRentalDays: 7,
};
const day = (date: string) => new Date(`${date}T17:00:00Z`);

describe('quoteFor', () => {
  it('charges the daily rate for each whole day', () => {
    expect(quoteFor(listing, day('2026-11-01'), day('2026-11-04'))).toEqual({
      listingId: listing.id,
      ownerId: listing.ownerId,
      days: 3,
      rentalFee: 6000,
      deposit: 30000,
      lateFeePerDay: 4000,
    });
  });

  it('allows exactly the maximum number of days', () => {
    expect(quoteFor(listing, day('2026-11-01'), day('2026-11-08')).days).toBe(
      7,
    );
  });

  it('rejects more days than the owner allows', () => {
    expect(() =>
      quoteFor(listing, day('2026-11-01'), day('2026-11-09')),
    ).toThrow('at most 7 days');
  });

  it('rejects times that are not Bangkok midnight', () => {
    expect(() =>
      quoteFor(listing, new Date('2026-11-01T00:00:00Z'), day('2026-11-03')),
    ).toThrow(BadRequestException);
  });

  it('rejects an empty or reversed period', () => {
    expect(() =>
      quoteFor(listing, day('2026-11-03'), day('2026-11-03')),
    ).toThrow('at least one day');
    expect(() =>
      quoteFor(listing, day('2026-11-03'), day('2026-11-01')),
    ).toThrow('at least one day');
  });
});
