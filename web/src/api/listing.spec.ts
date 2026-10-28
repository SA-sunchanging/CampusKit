import { describe, expect, it } from 'vitest';
import { searchQuery } from './listing.ts';

describe('searchQuery', () => {
  it('is empty when no filter is set', () => {
    expect(searchQuery({})).toBe('');
  });

  it('leaves out blank keywords and the default page', () => {
    expect(searchQuery({ q: '   ', page: 1 })).toBe('');
  });

  it('trims the keyword and keeps the category', () => {
    expect(searchQuery({ q: '  calculus ', category: 'BOOKS' })).toBe(
      '?q=calculus&category=BOOKS',
    );
  });

  it('keeps pages after the first', () => {
    expect(searchQuery({ category: 'SPORTS', page: 3 })).toBe(
      '?category=SPORTS&page=3',
    );
  });

  it('includes the page size only when given', () => {
    expect(searchQuery({ pageSize: 20 })).toBe('?pageSize=20');
  });

  it('encodes special characters in the keyword', () => {
    expect(searchQuery({ q: 'gown & cap' })).toBe('?q=gown+%26+cap');
  });
});
