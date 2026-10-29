import { Logger } from '@nestjs/common';

export const DEFAULT_TTL_DAYS = 30;
const MAX_TTL_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many days an authorization stays capturable: PAYMENT_AUTHORIZATION_TTL_DAYS, a whole
 * number from 1 to 3650, or 30 when it is unset or invalid.
 */
export function authorizationTtlDays(
  value = process.env.PAYMENT_AUTHORIZATION_TTL_DAYS,
): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_TTL_DAYS;
  }
  const days = Number(value);
  if (!/^\s*\d+\s*$/.test(value) || days < 1 || days > MAX_TTL_DAYS) {
    new Logger('AuthorizationTtl').warn(
      `PAYMENT_AUTHORIZATION_TTL_DAYS="${value}" is not a whole number from 1 to ${MAX_TTL_DAYS}; using ${DEFAULT_TTL_DAYS}`,
    );
    return DEFAULT_TTL_DAYS;
  }
  return days;
}

/** The time an authorization made at now expires. */
export function expiresAt(now: Date, ttlDays: number): Date {
  return new Date(now.getTime() + ttlDays * DAY_MS);
}
