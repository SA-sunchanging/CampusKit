import type { Terms } from './booking.ts';
import { api } from './client.ts';
import type { DateRange } from './listing.ts';

// Rental calls through the gateway (role D). Types follow the gateway's Swagger page
// (tag "rentals"). Money is integer satang; times are ISO-8601 UTC.
export const RENTAL_STATUSES = [
  'AWAITING_PICKUP',
  'ACTIVE',
  'SETTLEMENT_PENDING',
  'CLOSED',
] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/** renter: the caller's own rentals; owner: rentals of the caller's listings. */
export type RentalRole = 'renter' | 'owner';

/** Every field is present: a time or text that is not set yet is an empty string. */
export interface Rental {
  id: string;
  bookingId: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  status: RentalStatus;
  /** Half-open [start, end), copied from the booking. */
  period: DateRange;
  /** Copied from the booking. */
  terms: Terms;
  /** Six digits, shown to the owner while AWAITING_PICKUP; empty otherwise. */
  pickupCode: string;
  /** Six digits, shown to the renter while ACTIVE; empty otherwise. */
  returnCode: string;
  pickedUpAt: string;
  returnedAt: string;
  /** Set when CLOSED. */
  closedAt: string;
  /** Whole days late, fixed at the return. */
  lateDays: number;
  /** Satang, fixed at the return. */
  lateFee: number;
  /** Why the last pickup or settlement step failed; empty otherwise. */
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

/** Builds "?role=...". */
export function rentalsQuery(role: RentalRole): string {
  return `?${new URLSearchParams({ role }).toString()}`;
}

/** The return body: the renter's code, or nothing when retrying a pending settlement. */
export function returnBody(code?: string): { code?: string } {
  return code ? { code } : {};
}

/** Newest first, at most 100. */
export async function listRentals(role: RentalRole): Promise<Rental[]> {
  const body = await api<{ rentals: Rental[] }>(
    `/rental/rentals${rentalsQuery(role)}`,
  );
  return body.rentals;
}

/** The renter or the owner only; anyone else gets 404. */
export function getRental(id: string): Promise<Rental> {
  return api(`/rental/rentals/${encodeURIComponent(id)}`);
}

/** Renter only: the owner's pickup code. The fee is captured and the answer is ACTIVE. */
export function confirmPickup(id: string, code: string): Promise<Rental> {
  return api(`/rental/rentals/${encodeURIComponent(id)}/pickup`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * Owner only: the renter's return code while ACTIVE, or no code to retry a SETTLEMENT_PENDING
 * rental. The answer is CLOSED, or SETTLEMENT_PENDING with lastError when settling failed.
 */
export function confirmReturn(id: string, code?: string): Promise<Rental> {
  return api(`/rental/rentals/${encodeURIComponent(id)}/return`, {
    method: 'POST',
    body: JSON.stringify(returnBody(code)),
  });
}
