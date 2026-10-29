import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DeclineBookingDto } from './decline-booking.dto.js';

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(DeclineBookingDto, body);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('DeclineBookingDto', () => {
  it('accepts no reason', () => {
    expect(parse({}).errors).toEqual([]);
  });

  it('trims the reason', () => {
    const { dto, errors } = parse({ reason: '  Needed it myself ' });
    expect(errors).toEqual([]);
    expect(dto.reason).toBe('Needed it myself');
  });

  it('accepts 500 characters after trimming', () => {
    expect(parse({ reason: ` ${'x'.repeat(500)} ` }).errors).toEqual([]);
  });

  it.each([['x'.repeat(501)], [42]])('rejects the reason %j', (reason) => {
    expect(parse({ reason }).errors).toContain('reason');
  });
});
