import { describe, expect, it } from 'vitest';
import { pageCount, periodDays, periodFromDays, readSearch } from './search.ts';

const period = {
  start: '2026-10-31T17:00:00.000Z',
  end: '2026-11-03T17:00:00.000Z',
};

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

describe('readSearch with location and dates', () => {
  it('reads the pickup point and the period', () => {
    const params = new URLSearchParams({
      location: 'ARTS',
      start: period.start,
      end: period.end,
    });
    expect(readSearch(params)).toEqual({ location: 'ARTS', period, page: 1 });
  });

  it.each([
    ['an unknown location', { location: 'SIAM' }],
    ['a start without an end', { start: period.start }],
    ['an end before the start', { start: period.end, end: period.start }],
    [
      'a period longer than 30 days',
      { start: period.start, end: '2026-12-31T17:00:00.000Z' },
    ],
    ['dates that are not times', { start: 'soon', end: 'later' }],
  ])('ignores %s', (_case, query) => {
    expect(readSearch(new URLSearchParams(query))).toEqual({ page: 1 });
  });
});

describe('periodFromDays', () => {
  it('turns the days into a half-open period of Bangkok midnights', () => {
    expect(periodFromDays('2026-11-01', '2026-11-04')).toEqual({ period });
  });

  it('allows no dates', () => {
    expect(periodFromDays('', '')).toEqual({});
  });

  it.each([
    ['2026-11-01', ''],
    ['', '2026-11-04'],
    ['2026-11-04', '2026-11-04'],
    ['2026-11-01', '2026-12-02'],
  ])('rejects pickup %j and return %j', (pickupDay, returnDay) => {
    expect(periodFromDays(pickupDay, returnDay).error).toBeTruthy();
  });

  it('accepts exactly 30 days', () => {
    expect(periodFromDays('2026-11-01', '2026-12-01').period).toBeDefined();
  });
});

describe('periodDays', () => {
  it('gives the inputs back their days', () => {
    expect(periodDays(period)).toEqual({
      pickupDay: '2026-11-01',
      returnDay: '2026-11-04',
    });
    expect(periodDays(undefined)).toEqual({ pickupDay: '', returnDay: '' });
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
