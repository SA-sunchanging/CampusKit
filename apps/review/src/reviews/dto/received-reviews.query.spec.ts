import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReceivedReviewsQuery } from './received-reviews.query.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';

function parse(query: Record<string, string>) {
  const dto = plainToInstance(ReceivedReviewsQuery, query);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('ReceivedReviewsQuery', () => {
  it('defaults to the first page of 20', () => {
    const { dto, errors } = parse({ userId: USER_ID });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('reads numbers from the query string', () => {
    const { dto, errors } = parse({
      userId: USER_ID,
      page: '2',
      pageSize: '50',
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ page: 2, pageSize: 50 });
  });

  it('requires a UUID user ID', () => {
    expect(parse({}).errors).toContain('userId');
    expect(parse({ userId: 'u1' }).errors).toContain('userId');
  });

  it.each([
    ['pageSize', '51'],
    ['pageSize', '0'],
    ['page', '0'],
    ['page', 'two'],
  ])('rejects %s=%s', (field, value) => {
    expect(parse({ userId: USER_ID, [field]: value }).errors).toContain(field);
  });
});
