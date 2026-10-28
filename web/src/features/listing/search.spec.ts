import { describe, expect, it } from 'vitest';
import { pageCount, readSearch } from './search.ts';

describe('readSearch', () => {
  it('reads the keyword, category, and page', () => {
    expect(
      readSearch(new URLSearchParams('q=+racket+&category=SPORTS&page=2')),
    ).toEqual({ q: 'racket', category: 'SPORTS', page: 2 });
  });

  it('defaults to the first page with no filters', () => {
    expect(readSearch(new URLSearchParams(''))).toEqual({ page: 1 });
  });

  it.each(['0', '-3', '1.5', 'two'])('treats page %j as page 1', (page) => {
    expect(readSearch(new URLSearchParams({ page })).page).toBe(1);
  });

  it('ignores an unknown category and a blank keyword', () => {
    expect(readSearch(new URLSearchParams('q=%20&category=CARS'))).toEqual({
      page: 1,
    });
  });

  it('keeps the keyword and page within the service limits', () => {
    const params = new URLSearchParams({ q: 'a'.repeat(120), page: '5000' });
    expect(readSearch(params)).toEqual({ q: 'a'.repeat(100), page: 1000 });
  });
});

describe('pageCount', () => {
  it('rounds up to whole pages', () => {
    expect(pageCount(25, 12)).toBe(3);
    expect(pageCount(24, 12)).toBe(2);
  });

  it('shows one page when nothing matches', () => {
    expect(pageCount(0, 12)).toBe(1);
  });
});
