import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MAX_USER_IDS, ReputationQuery } from './reputation.query.js';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const RENTER_ID = '33333333-3333-4333-8333-333333333333';

function parse(query: Record<string, string>) {
  const dto = plainToInstance(ReputationQuery, query);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('ReputationQuery', () => {
  it('splits a comma-separated list and ignores spaces and empty parts', () => {
    const { dto, errors } = parse({ userIds: ` ${OWNER_ID} ,,${RENTER_ID},` });
    expect(errors).toEqual([]);
    expect(dto.userIds).toEqual([OWNER_ID, RENTER_ID]);
  });

  it(`accepts ${MAX_USER_IDS} IDs`, () => {
    const userIds = Array(MAX_USER_IDS).fill(OWNER_ID).join(',');
    expect(parse({ userIds }).errors).toEqual([]);
  });

  it.each([
    ['missing', {}],
    ['empty', { userIds: '' }],
    ['not a UUID', { userIds: `${OWNER_ID},u1` }],
    [
      'too many',
      {
        userIds: Array(MAX_USER_IDS + 1)
          .fill(OWNER_ID)
          .join(','),
      },
    ],
  ])('rejects a list that is %s', (_case, query) => {
    expect(parse(query).errors).toContain('userIds');
  });
});
