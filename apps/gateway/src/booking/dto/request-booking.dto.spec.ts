import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RequestBookingDto } from './request-booking.dto.js';

const valid = {
  listingId: '11111111-1111-4111-8111-111111111111',
  period: { start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' },
};

function errorsFor(fields: Record<string, unknown>): string[] {
  const dto = plainToInstance(RequestBookingDto, { ...valid, ...fields });
  return validateSync(dto).map((error) => error.property);
}

describe('RequestBookingDto', () => {
  it('accepts a listing and a period', () => {
    expect(errorsFor({})).toEqual([]);
  });

  it.each([
    ['listingId', 'listing-1'],
    ['listingId', undefined],
    ['period', undefined],
    ['period', { start: '2026-02-30T17:00:00Z', end: '2026-11-04T17:00:00Z' }],
    ['period', { start: '2026-11-01T17:00:00Z', end: 'tomorrow' }],
    ['period', { start: '2026-11-01T17:00:00Z' }],
  ])('rejects an invalid %s', (field, value) => {
    expect(errorsFor({ [field]: value })).toContain(field);
  });
});
