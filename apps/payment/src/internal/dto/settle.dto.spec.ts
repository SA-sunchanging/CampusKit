import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SettleDto } from './settle.dto.js';

const valid = {
  operationId: 'rental:r1:settle',
  bookingId: '22222222-2222-4222-8222-222222222222',
  deposit: 30000,
  lateFee: 0,
};

function errorsFor(fields: Record<string, unknown>): string[] {
  const dto = plainToInstance(SettleDto, { ...valid, ...fields });
  return validateSync(dto).map((error) => error.property);
}

describe('SettleDto', () => {
  it('accepts zero amounts', () => {
    expect(errorsFor({ deposit: 0, lateFee: 0 })).toEqual([]);
  });

  it.each([
    ['deposit', -1],
    ['deposit', 1.5],
    ['lateFee', -1],
    ['lateFee', undefined],
    ['lateFee', 2_147_483_648],
  ])('rejects an invalid %s', (field, value) => {
    expect(errorsFor({ [field]: value })).toContain(field);
  });
});
