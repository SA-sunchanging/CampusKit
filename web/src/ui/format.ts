// Display helpers shared by every role (role A). Money is integer satang and
// times are ISO-8601 UTC (docs/team-plan.md); users are all in Bangkok.
const TIME_ZONE = 'Asia/Bangkok';

const bahtWhole = new Intl.NumberFormat('en-TH', {
  style: 'currency',
  currency: 'THB',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const bahtSatang = new Intl.NumberFormat('en-TH', {
  style: 'currency',
  currency: 'THB',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayMonth = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

const yearOnly = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
});

/** 15000 satang -> baht sign + "150"; 15050 -> baht sign + "150.50". */
export function formatBaht(satang: number): string {
  const format = satang % 100 === 0 ? bahtWhole : bahtSatang;
  return format.format(satang / 100);
}

/** "2026-10-31T18:00:00Z" -> "1 Nov 2026" (Bangkok date). */
export function formatDate(iso: string): string {
  return dayMonthYear.format(new Date(iso));
}

/**
 * A half-open range [start, end): the end is the return day, so it is shown as
 * stored. "1 Nov - 3 Nov 2026", or "30 Dec 2026 - 2 Jan 2027" across years.
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameYear = yearOnly.format(start) === yearOnly.format(end);
  const from = sameYear ? dayMonth.format(start) : dayMonthYear.format(start);
  return `${from} - ${dayMonthYear.format(end)}`;
}
