import { BadRequestException } from '@nestjs/common';
import type { Blackout } from './listing.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Asia/Bangkok is UTC+7 all year (no daylight saving). */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
export const MAX_BLACKOUTS = 10;
const HORIZON_MS = 366 * DAY_MS;

/** True when the instant is 00:00 in Bangkok, the boundary of a rental day. */
export function isBangkokMidnight(date: Date): boolean {
  return (date.getTime() + BANGKOK_OFFSET_MS) % DAY_MS === 0;
}

/**
 * Checks the owner's unavailable dates with the same rules Booking applies, so the owner gets
 * a 400 before a DRAFT is saved: at most 10 ranges of whole Bangkok days, each ending within a
 * year, none overlapping another. Returns them sorted by start.
 */
export function checkBlackouts(blackouts: Blackout[], now: Date): Blackout[] {
  if (blackouts.length > MAX_BLACKOUTS) {
    throw new BadRequestException(
      `At most ${MAX_BLACKOUTS} unavailable periods are allowed`,
    );
  }
  const sorted = [...blackouts].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  sorted.forEach((blackout, index) => {
    const start = new Date(blackout.start);
    const end = new Date(blackout.end);
    if (!isBangkokMidnight(start) || !isBangkokMidnight(end)) {
      throw new BadRequestException(
        'Unavailable periods must start and end at midnight in Bangkok',
      );
    }
    if (start >= end) {
      throw new BadRequestException(
        'An unavailable period must end after it starts',
      );
    }
    if (end.getTime() > now.getTime() + HORIZON_MS) {
      throw new BadRequestException(
        'Unavailable periods must end within one year',
      );
    }
    if (index > 0 && start < new Date(sorted[index - 1].end)) {
      throw new BadRequestException('Unavailable periods must not overlap');
    }
  });
  return sorted.map(({ start, end }) => ({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }));
}
