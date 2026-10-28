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
  ])('rejects %s=%s', (field, value) => {
    expect(parse({ [field]: value }).errors).toContain(field);
  });
});
