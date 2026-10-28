import { checkBlackouts, isBangkokMidnight } from './blackouts.js';

const now = new Date('2026-10-28T05:00:00Z');
const day = (date: string) => `${date}T17:00:00Z`;

describe('isBangkokMidnight', () => {
  it('treats 17:00 UTC as the start of a Bangkok day', () => {
    expect(isBangkokMidnight(new Date(day('2026-11-01')))).toBe(true);
    expect(isBangkokMidnight(new Date('2026-11-01T00:00:00Z'))).toBe(false);
  });
});

describe('checkBlackouts', () => {
  it('returns the periods sorted and normalized', () => {
    expect(
      checkBlackouts(
        [
          { start: day('2026-11-10'), end: day('2026-11-11') },
          { start: day('2026-11-01'), end: day('2026-11-03') },
        ],
        now,
      ),
    ).toEqual([
      { start: '2026-11-01T17:00:00.000Z', end: '2026-11-03T17:00:00.000Z' },
      { start: '2026-11-10T17:00:00.000Z', end: '2026-11-11T17:00:00.000Z' },
    ]);
  });

  it('rejects more than ten periods', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      start: day(`2026-12-${String(i + 1).padStart(2, '0')}`),
      end: day(`2026-12-${String(i + 2).padStart(2, '0')}`),
    }));
    expect(() => checkBlackouts(many, now)).toThrow('At most 10');
  });

  it('rejects a period that is not whole days', () => {
    expect(() =>
      checkBlackouts(
        [{ start: '2026-11-01T12:00:00Z', end: day('2026-11-02') }],
        now,
      ),
    ).toThrow('midnight');
  });

  it('rejects an empty or reversed period', () => {
    expect(() =>
      checkBlackouts(
        [{ start: day('2026-11-02'), end: day('2026-11-02') }],
        now,
      ),
    ).toThrow('end after it starts');
  });

  it('rejects a period ending more than a year ahead', () => {
    expect(() =>
      checkBlackouts(
        [{ start: day('2027-11-01'), end: day('2027-11-02') }],
        now,
      ),
    ).toThrow('within one year');
  });

  it('rejects overlapping periods', () => {
    expect(() =>
      checkBlackouts(
        [
          { start: day('2026-11-01'), end: day('2026-11-04') },
          { start: day('2026-11-03'), end: day('2026-11-05') },
        ],
        now,
      ),
    ).toThrow('must not overlap');
  });
});
