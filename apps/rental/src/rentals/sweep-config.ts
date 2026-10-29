import { Logger } from '@nestjs/common';
import { DAY_MS } from './late-fee.js';

export const DEFAULT_SWEEP_INTERVAL_MS = 60_000;
export const DEFAULT_REMINDER_LEAD_MS = DAY_MS;

/**
 * A whole number of milliseconds from min to max read from the environment variable name, or
 * fallback (with a warning when the value is set but invalid).
 */
function wholeMs(
  name: string,
  value: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const ms = Number(value);
  if (!/^\s*\d+\s*$/.test(value) || ms < min || ms > max) {
    new Logger('RentalSweeper').warn(
      `${name}="${value}" is not a whole number from ${min} to ${max}; using ${fallback}`,
    );
    return fallback;
  }
  return ms;
}

/** How often the rental sweeper runs: RENTAL_SWEEP_INTERVAL_MS, 1 second to 1 day; 1 minute by default. */
export function sweepIntervalMs(
  value = process.env.RENTAL_SWEEP_INTERVAL_MS,
): number {
  return wholeMs(
    'RENTAL_SWEEP_INTERVAL_MS',
    value,
    1000,
    DAY_MS,
    DEFAULT_SWEEP_INTERVAL_MS,
  );
}

/**
 * How long before the period ends the renter is reminded: RENTAL_REMINDER_LEAD_MS, 1 second to
 * 30 days; 1 day by default. A demo shortens it to see the reminder sooner.
 */
export function reminderLeadMs(
  value = process.env.RENTAL_REMINDER_LEAD_MS,
): number {
  return wholeMs(
    'RENTAL_REMINDER_LEAD_MS',
    value,
    1000,
    30 * DAY_MS,
    DEFAULT_REMINDER_LEAD_MS,
  );
}
