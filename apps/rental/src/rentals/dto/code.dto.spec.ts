import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CodeDto } from './code.dto.js';

function errorsFor(body: object): string[] {
  return validateSync(plainToInstance(CodeDto, body)).map(
    (error) => error.property,
  );
}

describe('CodeDto', () => {
  it('accepts a code', () => {
    expect(errorsFor({ code: '012345' })).toEqual([]);
  });

  it.each([{}, { code: '' }, { code: 12345 }, { code: '1'.repeat(21) }])(
    'rejects %j',
    (body) => {
      expect(errorsFor(body)).toContain('code');
    },
  );
});
