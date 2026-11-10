import { describe, expect, it } from 'vitest';
import { readRole, roleParams } from './role.ts';

describe('readRole', () => {
  it.each(['owner', 'renter'] as const)(
    'reads the %s tab from the URL',
    (role) => {
      expect(readRole(new URLSearchParams({ role }))).toBe(role);
    },
  );

  it.each(['', '?role=', '?role=admin', '?role=OWNER'])(
    'falls back to renter for %j',
    (query) => {
      expect(readRole(new URLSearchParams(query))).toBe('renter');
    },
  );
});

describe('roleParams', () => {
  it.each(['owner', 'renter'] as const)(
    'sets the %s tab while preserving unrelated parameters',
    (role) => {
      const current = new URLSearchParams('role=invalid&from=inbox');
      const next = roleParams(current, role);
      expect(next.toString()).toBe(`role=${role}&from=inbox`);
      expect(readRole(next)).toBe(role);
      expect(current.toString()).toBe('role=invalid&from=inbox');
    },
  );

  it('keeps a separate query for each tab so browser history can restore it', () => {
    const owner = roleParams(new URLSearchParams(), 'owner');
    const renter = roleParams(owner, 'renter');
    expect(readRole(owner)).toBe('owner');
    expect(readRole(renter)).toBe('renter');
  });
});
