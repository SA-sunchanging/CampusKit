import { describe, expect, it } from 'vitest';
import { bookingsQuery, periodQuery } from './booking.ts';

describe('bookingsQuery', () => {
  it('always sends the role', () => {
    expect(bookingsQuery('renter')).toBe('?role=renter');
  });

  it('adds the status when given', () => {
    expect(bookingsQuery('owner', 'PENDING')).toBe(
      '?role=owner&status=PENDING',
    );
  });
});

describe('periodQuery', () => {
  it('encodes both ends', () => {
    expect(
      periodQuery({
        start: '2026-11-01T17:00:00.000Z',
        end: '2026-11-04T17:00:00.000Z',
      }),
    ).toBe(
      '?start=2026-11-01T17%3A00%3A00.000Z&end=2026-11-04T17%3A00%3A00.000Z',
    );
  });
});
