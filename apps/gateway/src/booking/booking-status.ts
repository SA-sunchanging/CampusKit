/** Booking statuses, defined by Booking (libs/contracts/proto/booking.proto). */
export const BOOKING_STATUSES = [
  'PENDING',
  'AUTHORIZING',
  'CONFIRMED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Which side of the bookings the caller lists. */
export const BOOKING_ROLES = ['renter', 'owner'] as const;
export type BookingRole = (typeof BOOKING_ROLES)[number];
