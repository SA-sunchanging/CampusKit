import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OwnerListingsQuery } from './owner-listings.query.js';

function parse(query: Record<string, string>) {
  const dto = plainToInstance(OwnerListingsQuery, query);
  const errors = validateSync(dto, { whitelist: true }).map(
    (error) => error.property,
  );
  return { dto, errors };
}

describe('OwnerListingsQuery', () => {
  it('defaults to the first page of 20', () => {
    expect(parse({})).toEqual({
      dto: { page: 1, pageSize: 20 },
      errors: [],
    });
  });

  it('reads page numbers and excludes supplied owner and status filters', () => {
    expect(
      parse({
        page: '3',
        pageSize: '50',
        ownerId: 'another-owner',
        status: 'PUBLISHED',
      }),
    ).toEqual({ dto: { page: 3, pageSize: 50 }, errors: [] });
  });

  it.each([
    ['page', '0'],
    ['page', '1001'],
    ['page', '1.5'],
    ['page', 'two'],
    ['pageSize', '0'],
    ['pageSize', '51'],
    ['pageSize', '2.5'],
  ])('rejects %s=%s', (field, value) => {
    expect(parse({ [field]: value }).errors).toEqual([field]);
  });
});
