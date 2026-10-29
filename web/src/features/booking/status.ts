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
};

export const STATUS_TONES: Record<BookingStatus, Tone> = {
  PENDING: 'warning',
  AUTHORIZING: 'warning',
  CONFIRMED: 'success',
  DECLINED: 'danger',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
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
