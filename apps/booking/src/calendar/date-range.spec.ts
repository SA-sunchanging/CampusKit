import {
  CalendarInputError,
  isBangkokMidnight,
  parseBlackouts,
  parsePeriod,
} from './date-range.js';

const now = new Date('2026-10-28T05:00:00Z');
const day = (date: string) => `${date}T17:00:00Z`;

describe('isBangkokMidnight', () => {
  it('accepts 17:00 UTC, which is 00:00 in Bangkok', () => {
    expect(isBangkokMidnight(new Date('2026-11-01T17:00:00Z'))).toBe(true);
  });

  it('rejects UTC midnight', () => {
    expect(isBangkokMidnight(new Date('2026-11-01T00:00:00Z'))).toBe(false);
  });
});

describe('parsePeriod', () => {
  it('rejects a time that is not ISO-8601 UTC', () => {
    expect(() =>
      parsePeriod({ start: '2026-11-01', end: day('2026-11-02') }),
    ).toThrow(CalendarInputError);
  });

  it('rejects an empty range', () => {
    expect(() =>
      parsePeriod({ start: day('2026-11-02'), end: day('2026-11-02') }),
    ).toThrow('start must be before end');
  });
});

describe('parseBlackouts', () => {
  it('returns whole-day ranges sorted by start', () => {
    const periods = parseBlackouts(
      [
        { start: day('2026-11-10'), end: day('2026-11-12') },
        { start: day('2026-11-01'), end: day('2026-11-02') },
      ],
      now,
    );
    expect(periods.map((p) => p.start.toISOString())).toEqual([
      '2026-11-01T17:00:00.000Z',
      '2026-11-10T17:00:00.000Z',
    ]);
  });

  it('accepts no blackouts and touching ranges', () => {
    expect(parseBlackouts([], now)).toEqual([]);
    expect(
      parseBlackouts(
        [
          { start: day('2026-11-01'), end: day('2026-11-02') },
          { start: day('2026-11-02'), end: day('2026-11-03') },
        ],
        now,
      ),
    ).toHaveLength(2);
  });

  it('rejects more than ten ranges', () => {
    const ranges = Array.from({ length: 11 }, (_, i) => ({
      start: day(`2026-12-${String(i + 1).padStart(2, '0')}`),
      end: day(`2026-12-${String(i + 2).padStart(2, '0')}`),
    }));
    expect(() => parseBlackouts(ranges, now)).toThrow('At most 10');
  });

  it('rejects a range that does not start at Bangkok midnight', () => {
    expect(() =>
      parseBlackouts(
        [{ start: '2026-11-01T00:00:00Z', end: day('2026-11-02') }],
        now,
      ),
    ).toThrow('midnight');
  });

  it('rejects a range ending more than a year ahead', () => {
    expect(() =>
      parseBlackouts(
        [{ start: day('2027-10-01'), end: day('2027-11-01') }],
        now,
      ),
    ).toThrow('within one year');
  });

  it('rejects overlapping ranges', () => {
    expect(() =>
      parseBlackouts(
        [
          { start: day('2026-11-01'), end: day('2026-11-05') },
          { start: day('2026-11-04'), end: day('2026-11-06') },
        ],
        now,
      ),
    ).toThrow('must not overlap');
  });
});
