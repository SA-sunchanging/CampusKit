import type { Booking, BookingRole, BookingStatus } from '../../api/booking.ts';
import type { Tone } from '../../ui/index.ts';

// Display names and tones for the booking statuses (role C). Booking keeps the codes stable.
export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Waiting for owner',
  AUTHORIZING: 'Authorizing payment',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  FAILED: 'Payment failed',
};

export const STATUS_TONES: Record<BookingStatus, Tone> = {
  PENDING: 'warning',
  AUTHORIZING: 'warning',
  CONFIRMED: 'success',
  DECLINED: 'danger',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  FAILED: 'danger',
};

function isKnown(status: string): status is BookingStatus {
  return Object.hasOwn(STATUS_LABELS, status);
}

/** The label, or the code itself for a status this page does not know yet. */
export function statusLabel(status: string): string {
  return isKnown(status) ? STATUS_LABELS[status] : status;
}

export function statusTone(status: string): Tone {
  return isKnown(status) ? STATUS_TONES[status] : 'neutral';
}

/** Recognized failure codes get guidance without displaying internal service errors. */
export function failureHint(
  booking: Pick<Booking, 'status' | 'failureReason'>,
): string | null {
  if (
    booking.status === 'FAILED' &&
    booking.failureReason === 'AUTHORIZATION_EXPIRES_BEFORE_RETURN'
  ) {
    return 'The payment hold does not last beyond the return date. Choose earlier dates and send a new booking request.';
  }
  return null;
}

/** decide: approve or decline; retry: approve again after payment authorization failed. */
export type OwnerAction = 'decide' | 'retry' | null;

/** What the viewer can do on a booking. Booking checks again on every call. */
export function ownerAction(
  booking: Pick<Booking, 'status' | 'period'>,
  role: BookingRole,
  now = new Date(),
): OwnerAction {
  if (role !== 'owner') return null;
  if (booking.status === 'PENDING') return 'decide';
  // Booking allows a retry until the rental period starts.
  if (
    booking.status === 'AUTHORIZING' &&
    Date.parse(booking.period.start) > now.getTime()
  ) {
    return 'retry';
  }
  return null;
}

/**
 * Whether the renter or the owner can cancel: a PENDING request that has not expired, or a
 * CONFIRMED booking. Booking refuses once the item is picked up.
 */
export function canCancel(
  booking: Pick<Booking, 'status' | 'expiresAt'>,
  now = new Date(),
): boolean {
  if (booking.status === 'PENDING') {
    return Date.parse(booking.expiresAt) > now.getTime();
  }
  return booking.status === 'CONFIRMED';
}
