import { describe, expect, it } from 'vitest';
import {
  addDays,
  bangkokDay,
  bangkokMidnight,
  formatDateTime,
} from './dates.ts';

describe('bangkokMidnight', () => {
  it('is 17:00 UTC on the day before', () => {
    expect(bangkokMidnight('2026-11-01')).toBe(
      Date.parse('2026-10-31T17:00:00Z'),
    );
  });

  it.each(['', '2026-02-30', '2026-13-01', '1/11/2026', '2026-11-1'])(
    'rejects %j',
    (day) => {
      expect(bangkokMidnight(day)).toBeNull();
    },
  );
});

describe('bangkokDay', () => {
  it('moves to the next day at 17:00 UTC', () => {
    expect(bangkokDay(Date.parse('2026-10-31T16:59:59Z'))).toBe('2026-10-31');
    expect(bangkokDay(Date.parse('2026-10-31T17:00:00Z'))).toBe('2026-11-01');
  });
});

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 2)).toBe('2027-01-02');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('formatDateTime', () => {
  it('shows the Bangkok date and time', () => {
    expect(formatDateTime('2026-10-30T08:05:00Z')).toBe('30 Oct 2026, 15:05');
  });
});
