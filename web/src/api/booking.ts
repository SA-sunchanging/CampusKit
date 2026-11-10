import { api } from './client.ts';
import type { DateRange } from './listing.ts';

// Booking calls through the gateway (role C). Types follow the gateway's Swagger page
// (tag "booking"). Money is integer satang; times are ISO-8601 UTC.
export const BOOKING_STATUSES = [
  'PENDING',
  'AUTHORIZING',
  'CONFIRMED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** renter: the caller's own requests; owner: requests on the caller's listings. */
export type BookingRole = 'renter' | 'owner';

/** Copied from the listing's quote when the request was made. */
export interface Terms {
  rentalFee: number;
  deposit: number;
  lateFeePerDay: number;
}

export interface Booking {
  id: string;
  listingId: string;
  renterId: string;
  ownerId: string;
  status: BookingStatus;
  /** Half-open [start, end); both ends are midnight in Bangkok. */
  period: DateRange;
  terms: Terms;
  /** Empty unless DECLINED. */
  declineReason: string;
  /** A safe failure code; absent on older responses. */
  failureReason?: string;
  /** A PENDING request expires at this time. */
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Builds "?role=...&status=...", leaving out an empty status. */
export function bookingsQuery(role: BookingRole, status?: BookingStatus) {
  const query = new URLSearchParams({ role });
  if (status) query.set('status', status);
  return `?${query.toString()}`;
}

/** Builds "?start=...&end=..." for the availability check. */
export function periodQuery(period: DateRange): string {
  const query = new URLSearchParams({ start: period.start, end: period.end });
  return `?${query.toString()}`;
}

/** The renter asks for a period; the answer is PENDING. */
export function requestBooking(
  listingId: string,
  period: DateRange,
): Promise<Booking> {
  return api('/booking/bookings', {
    method: 'POST',
    body: JSON.stringify({ listingId, period }),
  });
}

/** Newest first. */
export async function listBookings(
  role: BookingRole,
  status?: BookingStatus,
): Promise<Booking[]> {
  const body = await api<{ bookings: Booking[] }>(
    `/booking/bookings${bookingsQuery(role, status)}`,
  );
  return body.bookings;
}

/** The renter or the owner only; anyone else gets 404. */
export function getBooking(id: string): Promise<Booking> {
  return api(`/booking/bookings/${encodeURIComponent(id)}`);
}

/** Owner only. CONFIRMED, or AUTHORIZING when payment is not finished; approve again to retry. */
export function approveBooking(id: string): Promise<Booking> {
  return api(`/booking/bookings/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });
}

/** Owner only, PENDING only. The reason is optional and shown to the renter. */
export function declineBooking(id: string, reason?: string): Promise<Booking> {
  const trimmed = reason?.trim();
  return api(`/booking/bookings/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
    body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
  });
}

/**
 * The renter or the owner, PENDING or CONFIRMED, before pickup. The reason is optional and
 * shown to the other person. The answer is CANCELLED; 409 once the item is picked up.
 */
export function cancelBooking(id: string, reason?: string): Promise<Booking> {
  const trimmed = reason?.trim();
  return api(`/booking/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
  });
}

/** Advisory: the request rechecks the dates when it reserves them. */
export async function checkAvailability(
  listingId: string,
  period: DateRange,
): Promise<boolean> {
  const body = await api<{ available: boolean }>(
    `/booking/listings/${encodeURIComponent(listingId)}/availability${periodQuery(period)}`,
  );
  return body.available;
}
