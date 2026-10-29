import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListBookingsQuery } from './list-bookings.query.js';

function parse(query: Record<string, string>) {
  const dto = plainToInstance(ListBookingsQuery, query);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('ListBookingsQuery', () => {
  it.each(['renter', 'owner'])('accepts role=%s without a status', (role) => {
    expect(parse({ role }).errors).toEqual([]);
  });

  it('accepts a status and treats an empty one as any', () => {
    expect(parse({ role: 'owner', status: 'PENDING' }).errors).toEqual([]);
    const { dto, errors } = parse({ role: 'owner', status: '' });
    expect(errors).toEqual([]);
    expect(dto.status).toBeUndefined();
  });

  it.each([
    [{}, 'role'],
    [{ role: 'admin' }, 'role'],
    [{ role: 'renter', status: 'pending' }, 'status'],
    [{ role: 'renter', status: 'ACTIVE' }, 'status'],
  ])('rejects %j', (query, field) => {
    expect(parse(query).errors).toContain(field);
  });
});
