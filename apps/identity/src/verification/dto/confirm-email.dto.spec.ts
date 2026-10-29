import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfirmEmailDto } from './confirm-email.dto.js';

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(ConfirmEmailDto, body);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('ConfirmEmailDto', () => {
  it('accepts six digits, trimmed', () => {
    const { dto, errors } = parse({ code: ' 042917 ' });
    expect(errors).toEqual([]);
    expect(dto.code).toBe('042917');
  });

  it.each([['12345'], ['1234567'], ['12a456'], [123456], [undefined]])(
    'rejects the code %j',
    (code) => {
      expect(parse({ code }).errors).toEqual(['code']);
    },
  );
});
