// Bangkok calendar days for the booking pages (role C). Asia/Bangkok is UTC+7
// all year (no daylight saving), so a day starts at 17:00 UTC the day before.
export const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 00:00 Bangkok at the start of a YYYY-MM-DD day, in ms; null for an invalid date. */
export function bangkokMidnight(day: string): number | null {
  const match = DAY.exec(day);
  if (!match) return null;
  const [year, month, date] = match.slice(1).map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) {
    return null;
  }
  return utc.getTime() - BANGKOK_OFFSET_MS;
}

/** The Bangkok day (YYYY-MM-DD) that contains an instant. */
export function bangkokDay(ms: number): string {
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** The day `days` after a valid YYYY-MM-DD day. */
export function addDays(day: string, days: number): string {
  const midnight = bangkokMidnight(day);
  if (midnight === null) throw new Error(`Invalid day: ${day}`);
  return bangkokDay(midnight + days * DAY_MS);
}

const dayAndTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "2026-10-30T08:00:00Z" -> "30 Oct 2026, 15:00" (Bangkok time). */
export function formatDateTime(iso: string): string {
  return dayAndTime.format(new Date(iso));
}
