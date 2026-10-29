import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AvailabilityQuery } from './availability.query.js';

function errorsFor(query: Record<string, string>): string[] {
  const dto = plainToInstance(AvailabilityQuery, query);
  return validateSync(dto).map((error) => error.property);
}

describe('AvailabilityQuery', () => {
  it('accepts an ISO-8601 period', () => {
    expect(
      errorsFor({ start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' }),
    ).toEqual([]);
  });

  it.each([
    [{ end: '2026-11-04T17:00:00Z' }, 'start'],
    [{ start: '2026-11-01T17:00:00Z', end: '2026-11-31T17:00:00Z' }, 'end'],
    [{ start: 'today', end: '2026-11-04T17:00:00Z' }, 'start'],
  ])('rejects %j', (query, field) => {
    expect(errorsFor(query)).toContain(field);
  });
});
