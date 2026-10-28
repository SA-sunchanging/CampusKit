/** A half-open interval [start, end), as the proto DateRange carries it. */
export interface DateRange {
  start: string;
  end: string;
}

export interface Period {
  start: Date;
  end: Date;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Asia/Bangkok is UTC+7 all year (no daylight saving). */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const MAX_BLACKOUTS = 10;
/** A blackout may end at most this long after now. */
export const BLACKOUT_HORIZON_MS = 366 * DAY_MS;

/** Thrown for input that breaks a calendar rule; the controller answers INVALID_ARGUMENT. */
export class CalendarInputError extends Error {}

/** True when the instant is 00:00 in Bangkok, the boundary of a rental day. */
export function isBangkokMidnight(date: Date): boolean {
  return (date.getTime() + BANGKOK_OFFSET_MS) % DAY_MS === 0;
}

function parseInstant(value: string, field: string): Date {
  const date = new Date(value);
  if (!ISO_UTC.test(value ?? '') || Number.isNaN(date.getTime())) {
    throw new CalendarInputError(`${field} must be an ISO-8601 UTC time`);
  }
  return date;
}

/** Parses a range and checks that start is before end. */
export function parsePeriod(range: DateRange | undefined): Period {
  if (!range) {
    throw new CalendarInputError('period is required');
  }
  const start = parseInstant(range.start, 'start');
  const end = parseInstant(range.end, 'end');
  if (start >= end) {
    throw new CalendarInputError('start must be before end');
  }
  return { start, end };
}

/**
 * Validates owner blackouts: at most 10, whole Bangkok days, ending within a year of now,
 * and not overlapping each other. Returns them sorted by start.
 */
export function parseBlackouts(ranges: DateRange[], now: Date): Period[] {
  if (ranges.length > MAX_BLACKOUTS) {
    throw new CalendarInputError(
      `At most ${MAX_BLACKOUTS} blackouts are allowed`,
    );
  }
  const periods = ranges.map(parsePeriod);
  for (const period of periods) {
    if (!isBangkokMidnight(period.start) || !isBangkokMidnight(period.end)) {
      throw new CalendarInputError(
        'Blackouts must start and end at midnight in Bangkok',
      );
    }
    if (period.end.getTime() > now.getTime() + BLACKOUT_HORIZON_MS) {
      throw new CalendarInputError('Blackouts must end within one year');
    }
  }
  periods.sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < periods.length; i++) {
    if (periods[i].start < periods[i - 1].end) {
      throw new CalendarInputError('Blackouts must not overlap');
    }
  }
  return periods;
}
