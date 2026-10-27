import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PayoutProfileDto } from './payout-profile.dto.js';

const valid = {
  method: 'PROMPTPAY',
  promptPayId: '0812345678',
  accountName: 'Somchai Jaidee',
};

function errorsFor(body: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(PayoutProfileDto, body)).map(
    (error) => error.property,
  );
}

describe('PayoutProfileDto', () => {
  it.each(['0812345678', '1234567890123'])(
    'accepts the PromptPay ID %s',
    (promptPayId) => {
      expect(errorsFor({ ...valid, promptPayId })).toEqual([]);
    },
  );

  it.each([
    '812345678',
    '1812345678',
    '08123456789',
    '123456789012',
    '081-234-5678',
    '081 234 5678',
    '',
  ])('rejects the PromptPay ID "%s"', (promptPayId) => {
    expect(errorsFor({ ...valid, promptPayId })).toEqual(['promptPayId']);
  });

  it('rejects a method other than PROMPTPAY', () => {
    expect(errorsFor({ ...valid, method: 'BANK_ACCOUNT' })).toEqual(['method']);
  });

  it('trims the account name and rejects a blank one', () => {
    const dto = plainToInstance(PayoutProfileDto, {
      ...valid,
      accountName: '  Somchai  ',
    });
    expect(dto.accountName).toBe('Somchai');
    expect(errorsFor({ ...valid, accountName: '   ' })).toEqual([
      'accountName',
    ]);
  });

  it('rejects an account name longer than 100 characters', () => {
    expect(errorsFor({ ...valid, accountName: 'a'.repeat(101) })).toEqual([
      'accountName',
    ]);
  });
});
