import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuthorizeDto } from './authorize.dto.js';

const valid = {
  operationId: 'booking:22222222-2222-4222-8222-222222222222:authorize-fee',
  bookingId: '22222222-2222-4222-8222-222222222222',
  payerId: '00000000-0000-4000-8000-000000000002',
  payeeId: '00000000-0000-4000-8000-000000000001',
  kind: 'FEE',
  amount: 6000,
};

function errorsFor(fields: Record<string, unknown>): string[] {
  const dto = plainToInstance(AuthorizeDto, { ...valid, ...fields });
  return validateSync(dto).map((error) => error.property);
}

describe('AuthorizeDto', () => {
  it('accepts a valid body', () => {
    expect(errorsFor({})).toEqual([]);
    expect(errorsFor({ amount: 2_147_483_647, kind: 'DEPOSIT' })).toEqual([]);
    expect(errorsFor({ requiredUntil: '2026-11-04T17:00:00.000Z' })).toEqual(
      [],
    );
  });

  it.each([
    ['operationId', ''],
    ['operationId', 'x'.repeat(201)],
    ['operationId', 12],
    ['bookingId', 'booking-1'],
    ['payerId', undefined],
    ['payeeId', 'owner'],
    ['kind', 'TIP'],
    ['amount', 0],
    ['amount', 1.5],
    ['amount', 2_147_483_648],
    ['amount', '6000'],
    ['requiredUntil', 'not-a-date'],
    ['requiredUntil', '2026-02-30T17:00:00Z'],
    ['requiredUntil', 123],
  ])('rejects an invalid %s', (field, value) => {
    expect(errorsFor({ [field]: value })).toContain(field);
  });
});
