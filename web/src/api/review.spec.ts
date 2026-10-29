import { describe, expect, it } from 'vitest';
import { receivedQuery, reviewBody } from './review.ts';

describe('receivedQuery', () => {
  it('asks for one page of the user', () => {
    expect(receivedQuery('u-1', 2)).toBe('?userId=u-1&page=2&pageSize=20');
  });

  it('encodes characters that would change the query', () => {
    expect(receivedQuery('a&b', 1)).toBe('?userId=a%26b&page=1&pageSize=20');
  });
});

describe('reviewBody', () => {
  it('trims the comment', () => {
    expect(reviewBody('r-1', 5, '  Great  ')).toEqual({
      rentalId: 'r-1',
      rating: 5,
      comment: 'Great',
    });
  });

  it('leaves out a blank comment', () => {
    expect(reviewBody('r-1', 3, '   ')).toEqual({ rentalId: 'r-1', rating: 3 });
  });
});
