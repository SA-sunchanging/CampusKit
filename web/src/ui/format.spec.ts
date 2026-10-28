import { describe, expect, it } from 'vitest';
import { formatBaht, formatDate, formatDateRange } from './format.ts';

// The Thai baht sign, escaped to keep the source ASCII.
const BAHT = '\u0e3f';

describe('formatBaht', () => {
  it('drops the decimals for whole baht', () => {
    expect(formatBaht(15000)).toBe(`${BAHT}150`);
  });

  it('shows two decimals when there are satang', () => {
    expect(formatBaht(15050)).toBe(`${BAHT}150.50`);
    expect(formatBaht(5)).toBe(`${BAHT}0.05`);
  });

  it('formats zero', () => {
    expect(formatBaht(0)).toBe(`${BAHT}0`);
  });

  it('groups thousands', () => {
    expect(formatBaht(123456700)).toBe(`${BAHT}1,234,567`);
  });
});

describe('formatDate', () => {
  it('uses the Bangkok date when UTC is still the previous day', () => {
    expect(formatDate('2026-10-31T18:00:00Z')).toBe('1 Nov 2026');
  });

  it('keeps the same date when Bangkok is on the same day', () => {
    expect(formatDate('2026-11-01T09:30:00Z')).toBe('1 Nov 2026');
  });
});

describe('formatDateRange', () => {
  it('shows the end as stored, since it is the return day', () => {
    expect(
      formatDateRange('2026-10-31T17:00:00Z', '2026-11-02T17:00:00Z'),
    ).toBe('1 Nov - 3 Nov 2026');
  });

  it('spans months within one year', () => {
    expect(
      formatDateRange('2026-11-29T17:00:00Z', '2026-12-04T17:00:00Z'),
    ).toBe('30 Nov - 5 Dec 2026');
  });

  it('shows both years when the range crosses a year', () => {
    expect(
      formatDateRange('2026-12-29T17:00:00Z', '2027-01-01T17:00:00Z'),
    ).toBe('30 Dec 2026 - 2 Jan 2027');
  });
});
