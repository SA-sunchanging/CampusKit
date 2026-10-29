import {
  authorizationTtlDays,
  DEFAULT_TTL_DAYS,
  expiresAt,
} from './authorization-ttl.js';

describe('authorizationTtlDays', () => {
  it('defaults to 30 days', () => {
    expect(DEFAULT_TTL_DAYS).toBe(30);
    expect(authorizationTtlDays(undefined)).toBe(30);
    expect(authorizationTtlDays('')).toBe(30);
  });

  it('reads a whole number of days', () => {
    expect(authorizationTtlDays('7')).toBe(7);
    expect(authorizationTtlDays(' 1 ')).toBe(1);
    expect(authorizationTtlDays('3650')).toBe(3650);
  });

  it.each(['0', '-3', '1.5', 'seven', '1e2', '3651'])(
    'falls back to 30 for %s',
    (value) => {
      expect(authorizationTtlDays(value)).toBe(30);
    },
  );
});

describe('expiresAt', () => {
  it('adds whole days', () => {
    expect(expiresAt(new Date('2026-10-29T05:00:00Z'), 30)).toEqual(
      new Date('2026-11-28T05:00:00Z'),
    );
  });
});
