import type { BookingRole } from '../../api/booking.ts';

/** Unknown or missing roles keep the default renter view. */
export function readRole(params: URLSearchParams): BookingRole {
  return params.get('role') === 'owner' ? 'owner' : 'renter';
}

/** Change tabs without dropping any other query parameters. */
export function roleParams(
  params: URLSearchParams,
  role: BookingRole,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('role', role);
  return next;
}
