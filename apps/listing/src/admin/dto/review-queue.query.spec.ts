import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReviewQueueQuery } from './review-queue.query.js';

function parse(query: Record<string, string>) {
  const dto = plainToInstance(ReviewQueueQuery, query);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('ReviewQueueQuery', () => {
  it('defaults to the first page of listings waiting for review', () => {
    const { dto, errors } = parse({});
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({
      status: 'PENDING_REVIEW',
      page: 1,
      pageSize: 20,
    });
  });

  it.each([
    ['status', 'ARCHIVED'],
    ['page', '0'],
    ['pageSize', '51'],
  ])('rejects %s=%s', (field, value) => {
    expect(parse({ [field]: value }).errors).toContain(field);
  });
});
