import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { StudentQueueQuery } from './student-queue.query.js';

function parse(query: Record<string, string>) {
  const dto = plainToInstance(StudentQueueQuery, query);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('StudentQueueQuery', () => {
  it('defaults to the first page of students waiting for review', () => {
    const { dto, errors } = parse({});
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ status: 'PENDING', page: 1, pageSize: 20 });
  });

  it('reads another status and page', () => {
    const { dto, errors } = parse({
      status: 'REJECTED',
      page: '3',
      pageSize: '50',
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ status: 'REJECTED', page: 3, pageSize: 50 });
  });

  it.each([
    ['status', 'SUSPENDED'],
    ['page', '0'],
    ['pageSize', '51'],
  ])('rejects %s=%s', (field, value) => {
    expect(parse({ [field]: value }).errors).toContain(field);
  });
});
