import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SearchListingsQuery } from './search-listings.query.js';

function parse(query: Record<string, string>) {
  const dto = plainToInstance(SearchListingsQuery, query);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('SearchListingsQuery', () => {
  it('defaults to the first page of 20 and treats empty values as any', () => {
    const { dto, errors } = parse({ q: '  ', category: '' });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ page: 1, pageSize: 20 });
    expect(dto.q).toBeUndefined();
    expect(dto.category).toBeUndefined();
  });

  it('reads numbers from the query string and trims the keyword', () => {
    const { dto, errors } = parse({ q: ' racket ', page: '3', pageSize: '50' });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ q: 'racket', page: 3, pageSize: 50 });
  });

  it.each([
    ['pageSize', '51'],
    ['pageSize', '0'],
    ['page', '0'],
    ['page', 'two'],
    ['category', 'CARS'],
    ['q', 'x'.repeat(101)],
    ['location', 'SIAM'],
  ])('rejects %s=%s', (field, value) => {
    expect(parse({ [field]: value }).errors).toContain(field);
  });

  it('reads a pickup location and a period', () => {
    const { dto, errors } = parse({
      location: 'ENGINEERING',
      start: '2026-11-01T17:00:00Z',
      end: '2026-12-01T17:00:00Z',
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({
      location: 'ENGINEERING',
      start: '2026-11-01T17:00:00Z',
      end: '2026-12-01T17:00:00Z',
    });
  });

  it('treats empty dates and location as any', () => {
    const { dto, errors } = parse({ start: '', end: '', location: '' });
    expect(errors).toEqual([]);
    expect(dto.start).toBeUndefined();
    expect(dto.location).toBeUndefined();
  });

  it.each([
    ['start without end', { start: '2026-11-01T17:00:00Z' }, 'end'],
    ['end without start', { end: '2026-11-02T17:00:00Z' }, 'start'],
    [
      'end before start',
      { start: '2026-11-02T17:00:00Z', end: '2026-11-01T17:00:00Z' },
      'end',
    ],
    [
      'an empty period',
      { start: '2026-11-01T17:00:00Z', end: '2026-11-01T17:00:00Z' },
      'end',
    ],
    [
      'more than 30 days',
      { start: '2026-11-01T17:00:00Z', end: '2026-12-02T17:00:00Z' },
      'end',
    ],
    [
      'a date that is not ISO',
      { start: 'tomorrow', end: '2026-11-02' },
      'start',
    ],
  ])('rejects %s', (_case, query, field) => {
    expect(parse(query).errors).toContain(field);
  });
});
