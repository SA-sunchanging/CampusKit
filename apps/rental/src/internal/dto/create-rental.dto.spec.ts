import { plainToInstance } from 'class-transformer';
import { type ValidationError, validateSync } from 'class-validator';
import { CreateRentalDto } from './create-rental.dto.js';

const valid = {
  bookingId: '22222222-2222-4222-8222-222222222222',
  listingId: '33333333-3333-4333-8333-333333333333',
  ownerId: '00000000-0000-4000-8000-000000000001',
  renterId: '00000000-0000-4000-8000-000000000002',
  period: { start: '2026-11-01T17:00:00.000Z', end: '2026-11-04T17:00:00Z' },
  terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
};

/** Paths of the invalid properties, such as "terms.deposit". */
function paths(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((error) =>
    error.children?.length
      ? paths(error.children, `${prefix}${error.property}.`)
      : [`${prefix}${error.property}`],
  );
}

function errorsFor(fields: Record<string, unknown>): string[] {
  return paths(
    validateSync(plainToInstance(CreateRentalDto, { ...valid, ...fields })),
  );
}

describe('CreateRentalDto', () => {
  it('accepts a valid body', () => {
    expect(errorsFor({})).toEqual([]);
    expect(
      errorsFor({
        terms: { rentalFee: 0, deposit: 2_147_483_647, lateFeePerDay: 0 },
      }),
    ).toEqual([]);
  });

  it.each([
    ['bookingId', { bookingId: 'booking-1' }],
    ['listingId', { listingId: undefined }],
    ['ownerId', { ownerId: 12 }],
    ['renterId', { renterId: 'renter' }],
    ['period', { period: undefined }],
    ['period.start', { period: { ...valid.period, start: '2026-11-31' } }],
    ['period.start', { period: { ...valid.period, start: 'tomorrow' } }],
    ['period.end', { period: { start: valid.period.start } }],
    ['terms', { terms: undefined }],
    ['terms.rentalFee', { terms: { ...valid.terms, rentalFee: -1 } }],
    ['terms.rentalFee', { terms: { ...valid.terms, rentalFee: 1.5 } }],
    ['terms.deposit', { terms: { ...valid.terms, deposit: 2_147_483_648 } }],
    ['terms.deposit', { terms: { ...valid.terms, deposit: '30000' } }],
    ['terms.lateFeePerDay', { terms: { ...valid.terms, lateFeePerDay: null } }],
  ])('rejects an invalid %s', (path, fields) => {
    expect(errorsFor(fields)).toContain(path);
  });
});
