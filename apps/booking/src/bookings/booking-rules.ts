import { status } from '@grpc/grpc-js';
import {
  DAY_MS,
  isBangkokMidnight,
  type Period,
} from '../calendar/date-range.js';
import { rpcError } from '../errors.js';

/** A renter may hold at most this many PENDING or AUTHORIZING requests at once. */
export const MAX_OPEN_REQUESTS = 5;
/** A requested period must end at most this long after now. */
export const REQUEST_HORIZON_MS = 366 * DAY_MS;
/** The owner has this long to answer a request, unless the period starts sooner. */
export const ANSWER_WINDOW_MS = DAY_MS;

/**
 * Checks a requested period: whole Bangkok days, starting after now (so tomorrow at the
 * earliest) and ending within 366 days. Throws INVALID_ARGUMENT otherwise.
 */
export function checkRequestPeriod(period: Period, now: Date): void {
  if (!isBangkokMidnight(period.start) || !isBangkokMidnight(period.end)) {
    throw rpcError(
      status.INVALID_ARGUMENT,
      'The period must start and end at midnight in Bangkok',
    );
  }
  if (period.start <= now) {
    throw rpcError(
      status.INVALID_ARGUMENT,
      'The period must start after today',
    );
  }
  if (period.end.getTime() > now.getTime() + REQUEST_HORIZON_MS) {
    throw rpcError(
      status.INVALID_ARGUMENT,
      'The period must end within 366 days',
    );
  }
}

/** When a PENDING request expires: 24 hours after it was made, or when the period starts if sooner. */
export function expiresAt(createdAt: Date, periodStart: Date): Date {
  return new Date(
    Math.min(createdAt.getTime() + ANSWER_WINDOW_MS, periodStart.getTime()),
  );
}

/** Throws FAILED_PRECONDITION when the renter already holds the maximum of open requests. */
export function checkOpenRequests(open: number): void {
  if (open >= MAX_OPEN_REQUESTS) {
    throw rpcError(
      status.FAILED_PRECONDITION,
      `You can have at most ${MAX_OPEN_REQUESTS} open booking requests`,
    );
  }
}
