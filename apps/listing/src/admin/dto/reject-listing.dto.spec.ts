import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RejectListingDto } from './reject-listing.dto.js';

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(RejectListingDto, body);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('RejectListingDto', () => {
  it('trims the reason', () => {
    const { dto, errors } = parse({ reason: '  Unsafe  ' });
    expect(errors).toEqual([]);
    expect(dto.reason).toBe('Unsafe');
  });

  it('accepts a reason of 300 characters', () => {
    expect(parse({ reason: 'x'.repeat(300) }).errors).toEqual([]);
  });

  it.each([['   '], ['x'.repeat(301)], [42], [undefined]])(
    'rejects the reason %j',
    (reason) => {
      expect(parse({ reason }).errors).toContain('reason');
    },
  );
});
