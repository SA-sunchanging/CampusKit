import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CancelBookingDto } from './cancel-booking.dto.js';

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(CancelBookingDto, body);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('CancelBookingDto', () => {
  it('accepts no reason', () => {
    expect(parse({}).errors).toEqual([]);
  });

  it('trims the reason', () => {
    const { dto, errors } = parse({ reason: '  Plans changed ' });
    expect(errors).toEqual([]);
    expect(dto.reason).toBe('Plans changed');
  });

  it('accepts 200 characters after trimming', () => {
    expect(parse({ reason: ` ${'x'.repeat(200)} ` }).errors).toEqual([]);
  });

  it.each([['x'.repeat(201)], [42]])('rejects the reason %j', (reason) => {
    expect(parse({ reason }).errors).toContain('reason');
  });
});
