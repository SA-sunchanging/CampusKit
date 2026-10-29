import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListRentalsQuery } from './list-rentals.query.js';

function errorsFor(query: { role?: string }): string[] {
  return validateSync(plainToInstance(ListRentalsQuery, query)).map(
    (error) => error.property,
  );
}

describe('ListRentalsQuery', () => {
  it.each(['renter', 'owner'])('accepts role=%s', (role) => {
    expect(errorsFor({ role })).toEqual([]);
  });

  it.each([{}, { role: '' }, { role: 'admin' }, { role: 'Renter' }])(
    'rejects %j',
    (query) => {
      expect(errorsFor(query)).toContain('role');
    },
  );
});
