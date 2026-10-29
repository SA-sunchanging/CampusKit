import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CaptureDto } from './capture.dto.js';
import { VoidDto } from './void.dto.js';

const valid = {
  operationId: 'rental:r1:capture-fee',
  bookingId: '22222222-2222-4222-8222-222222222222',
  amount: 6000,
};

function errorsFor(fields: Record<string, unknown>): string[] {
  const dto = plainToInstance(CaptureDto, { ...valid, ...fields });
  return validateSync(dto).map((error) => error.property);
}

describe('CaptureDto', () => {
  it('accepts an amount of 0 or more', () => {
    expect(errorsFor({})).toEqual([]);
    expect(errorsFor({ amount: 0 })).toEqual([]);
  });

  it.each([
    ['amount', -1],
    ['amount', 0.5],
    ['amount', 2_147_483_648],
    ['bookingId', 'b1'],
    ['operationId', ''],
  ])('rejects an invalid %s', (field, value) => {
    expect(errorsFor({ [field]: value })).toContain(field);
  });
});

describe('VoidDto', () => {
  it('needs an operation ID and a booking ID', () => {
    expect(validateSync(plainToInstance(VoidDto, valid))).toEqual([]);
    const errors = validateSync(plainToInstance(VoidDto, {}));
    expect(errors.map((error) => error.property)).toEqual([
      'operationId',
      'bookingId',
    ]);
  });
});
