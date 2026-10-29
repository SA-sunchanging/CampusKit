import { FakeRentalDb } from '../testing/fake-rental-db.js';
import { rentalRow } from '../testing/fixtures.js';
import {
  afterWrongCode,
  checkCode,
  MAX_CODE_ATTEMPTS,
} from './code-attempts.js';

const newCode = () => '555555';

describe('afterWrongCode', () => {
  it.each([0, 1, 2, 3])('counts attempt %i + 1 and keeps the code', (n) => {
    expect(afterWrongCode(n, '012345', newCode)).toEqual({
      attempts: n + 1,
      code: '012345',
      replaced: false,
    });
  });

  it('replaces the code and restarts the counter at the fifth wrong attempt', () => {
    expect(MAX_CODE_ATTEMPTS).toBe(5);
    expect(afterWrongCode(4, '012345', newCode)).toEqual({
      attempts: 0,
      code: '555555',
      replaced: true,
    });
  });

  it('makes a six-digit code by default', () => {
    expect(afterWrongCode(4, '012345').code).toMatch(/^[0-9]{6}$/);
  });
});

describe('checkCode', () => {
  it('accepts the right code and changes nothing', async () => {
    const fake = new FakeRentalDb(rentalRow());
    await expect(
      checkCode(fake.dataSource, rentalRow(), 'pickup', '012345'),
    ).resolves.toBe('match');
    expect(fake.updates()).toEqual([]);
  });

  it('counts a wrong pickup code on the pickup counter', async () => {
    const row = rentalRow({ pickup_attempts: 2 });
    const fake = new FakeRentalDb(row);
    await expect(
      checkCode(fake.dataSource, row, 'pickup', '000000'),
    ).resolves.toBe('wrong');
    expect(fake.row).toMatchObject({
      pickup_attempts: 3,
      pickup_code: '012345',
      return_attempts: 0,
    });
  });

  it('replaces the return code at the fifth wrong return code', async () => {
    const row = rentalRow({ status: 'ACTIVE', return_attempts: 4 });
    const fake = new FakeRentalDb(row);
    await expect(
      checkCode(fake.dataSource, row, 'return', '111111', newCode),
    ).resolves.toBe('replaced');
    expect(fake.row).toMatchObject({
      return_attempts: 0,
      return_code: '555555',
      pickup_code: '012345',
    });
  });

  it.each([undefined, '', '12345', '0123456', 12345])(
    'counts %j as a wrong code',
    async (given) => {
      const fake = new FakeRentalDb(rentalRow());
      await expect(
        checkCode(fake.dataSource, rentalRow(), 'pickup', given),
      ).resolves.toBe('wrong');
      expect(fake.row?.pickup_attempts).toBe(1);
    },
  );
});
