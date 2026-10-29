import type { DateRange, Listing } from '../../api/listing.ts';
import { addDays, bangkokDay, bangkokMidnight, DAY_MS } from './dates.ts';

// Checks and conversion for the booking request form (role C). The rules mirror
// Booking for quick feedback; the server stays authoritative.

/** Booking accepts periods that end at most this long after now. */
const HORIZON_MS = 366 * DAY_MS;

/** The two date inputs, as YYYY-MM-DD (empty until chosen). */
export interface BookingDays {
  pickupDay: string;
  returnDay: string;
}

export type BookingFormErrors = Partial<Record<keyof BookingDays, string>>;

export const EMPTY_DAYS: BookingDays = { pickupDay: '', returnDay: '' };

/** Bounds for the date inputs' min and max. */
export interface DayLimits {
  minPickup: string;
  maxPickup: string;
  minReturn: string;
  maxReturn: string;
}

export interface Estimate {
  days: number;
  rentalFee: number;
  deposit: number;
  lateFeePerDay: number;
}

/**
 * The half-open period Booking stores: from 00:00 Bangkok on the pickup day to
 * 00:00 Bangkok on the return day. Null when a day is invalid or the return day
 * is not after the pickup day.
 */
export function toBookingPeriod(days: BookingDays): DateRange | null {
  const start = bangkokMidnight(days.pickupDay);
  const end = bangkokMidnight(days.returnDay);
  if (start === null || end === null || end <= start) return null;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}

/** Whole rental days in a period: the return day minus the pickup day. */
export function rentalDays(period: DateRange): number {
  return Math.round(
    (Date.parse(period.end) - Date.parse(period.start)) / DAY_MS,
  );
}

/** Pickup tomorrow at the earliest; return within the listing's limit and one year. */
export function dayLimits(
  pickupDay: string,
  maxRentalDays: number,
  now: Date,
): DayLimits {
  const minPickup = bangkokDay(now.getTime() + DAY_MS);
  const maxReturn = bangkokDay(now.getTime() + HORIZON_MS);
  const pickup = bangkokMidnight(pickupDay) === null ? minPickup : pickupDay;
  const longest = addDays(pickup, maxRentalDays);
  return {
    minPickup,
    maxPickup: addDays(maxReturn, -1),
    minReturn: addDays(pickup, 1),
    maxReturn: longest < maxReturn ? longest : maxReturn,
  };
}

function pickupError(day: string, now: Date): string | undefined {
  if (!day) return 'Choose a pickup day.';
  const start = bangkokMidnight(day);
  if (start === null) return 'Enter a valid date.';
  if (start <= now.getTime()) return 'The earliest pickup day is tomorrow.';
  return undefined;
}

function returnError(
  days: BookingDays,
  maxRentalDays: number,
  now: Date,
): string | undefined {
  if (!days.returnDay) return 'Choose a return day.';
  const end = bangkokMidnight(days.returnDay);
  if (end === null) return 'Enter a valid date.';
  const period = toBookingPeriod(days);
  if (bangkokMidnight(days.pickupDay) !== null && !period) {
    return 'The return day must be after the pickup day.';
  }
  if (period && rentalDays(period) > maxRentalDays) {
    const limit = maxRentalDays === 1 ? '1 day' : `${maxRentalDays} days`;
    return `This item can be rented for at most ${limit}.`;
  }
  if (end > now.getTime() + HORIZON_MS) {
    return 'The return day must be within one year from today.';
  }
  return undefined;
}

/** A message per invalid input; an empty object means the request can be sent. */
export function validateBookingDays(
  days: BookingDays,
  maxRentalDays: number,
  now = new Date(),
): BookingFormErrors {
  const errors: BookingFormErrors = {
    pickupDay: pickupError(days.pickupDay, now),
    returnDay: returnError(days, maxRentalDays, now),
  };
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  );
}

/** What the renter would pay, as the listing's quote computes it. Money is satang. */
export function estimate(
  period: DateRange,
  listing: Pick<Listing, 'dailyRate' | 'deposit' | 'lateFeePerDay'>,
): Estimate {
  const days = rentalDays(period);
  return {
    days,
    rentalFee: days * listing.dailyRate,
    deposit: listing.deposit,
    lateFeePerDay: listing.lateFeePerDay,
  };
}
