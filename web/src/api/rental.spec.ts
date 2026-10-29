import { describe, expect, it } from 'vitest';
import { rentalsQuery, returnBody } from './rental.ts';

describe('rentalsQuery', () => {
  it('sends the role', () => {
    expect(rentalsQuery('renter')).toBe('?role=renter');
    expect(rentalsQuery('owner')).toBe('?role=owner');
  });
});

describe('returnBody', () => {
  it('sends the code when given', () => {
    expect(returnBody('012345')).toEqual({ code: '012345' });
  });

  it('sends no code for a settlement retry', () => {
    expect(returnBody()).toEqual({});
    expect(returnBody('')).toEqual({});
  });
});
