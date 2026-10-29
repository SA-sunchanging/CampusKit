import type { AuthorizationStatus } from '../../api/payment.ts';
import type { Rental, RentalStatus } from '../../api/rental.ts';
import type { Tone } from '../../ui/index.ts';
import { formatDateTime } from '../booking/dates.ts';

// Display names, tones and next steps for the rental statuses (role D). Rental keeps the
// codes stable and checks every step again on the server.
export const STATUS_LABELS: Record<RentalStatus, string> = {
  AWAITING_PICKUP: 'Waiting for pickup',
  ACTIVE: 'With the renter',
  SETTLEMENT_PENDING: 'Settling payment',
  CLOSED: 'Closed',
};

export const STATUS_TONES: Record<RentalStatus, Tone> = {
  AWAITING_PICKUP: 'warning',
  ACTIVE: 'success',
  SETTLEMENT_PENDING: 'warning',
  CLOSED: 'neutral',
};

function isKnown(status: string): status is RentalStatus {
  return Object.hasOwn(STATUS_LABELS, status);
}

/** The label, or the code itself for a status this page does not know yet. */
export function statusLabel(status: string): string {
  return isKnown(status) ? STATUS_LABELS[status] : status;
}

export function statusTone(status: string): Tone {
  return isKnown(status) ? STATUS_TONES[status] : 'neutral';
}

/** Payment's hold statuses, as the renter and the owner read them. */
export const PAYMENT_LABELS: Record<AuthorizationStatus, string> = {
  AUTHORIZED: 'Held',
  CAPTURED: 'Paid',
  SETTLED: 'Settled',
  VOIDED: 'Released',
  EXPIRED: 'Hold expired',
};

export const PAYMENT_TONES: Record<AuthorizationStatus, Tone> = {
  AUTHORIZED: 'warning',
  CAPTURED: 'success',
  SETTLED: 'success',
  VOIDED: 'neutral',
  EXPIRED: 'danger',
};

/** The label, or the code itself for a status this page does not know yet. */
export function paymentLabel(status: string): string {
  return Object.hasOwn(PAYMENT_LABELS, status)
    ? PAYMENT_LABELS[status as AuthorizationStatus]
    : status;
}

export function paymentTone(status: string): Tone {
  return Object.hasOwn(PAYMENT_TONES, status)
    ? PAYMENT_TONES[status as AuthorizationStatus]
    : 'neutral';
}

/** The renter can pick up from this long before the period starts until it ends. */
export const PICKUP_OPENS_BEFORE_MS = 24 * 60 * 60 * 1000;

export type RentalAction =
  | 'show-pickup-code'
  | 'enter-pickup-code'
  | 'wait-for-pickup-window'
  | 'show-return-code'
  | 'enter-return-code'
  | 'retry-settlement'
  | 'none';

type RentalView = Pick<Rental, 'status' | 'ownerId' | 'renterId' | 'period'>;

/** UUIDs ignore case, as on the server. */
function same(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** When the renter may first enter the pickup code, in ms. */
export function pickupOpensAt(rental: Pick<Rental, 'period'>): number {
  return Date.parse(rental.period.start) - PICKUP_OPENS_BEFORE_MS;
}

function renterAction(rental: RentalView, now: Date): RentalAction {
  if (rental.status === 'ACTIVE') return 'show-return-code';
  if (rental.status !== 'AWAITING_PICKUP') return 'none';
  const time = now.getTime();
  if (time < pickupOpensAt(rental)) return 'wait-for-pickup-window';
  return time < Date.parse(rental.period.end) ? 'enter-pickup-code' : 'none';
}

function ownerAction(rental: RentalView): RentalAction {
  switch (rental.status) {
    case 'AWAITING_PICKUP':
      return 'show-pickup-code';
    case 'ACTIVE':
      return 'enter-return-code';
    case 'SETTLEMENT_PENDING':
      return 'retry-settlement';
    default:
      return 'none';
  }
}

/** What the viewer does next on a rental. */
export function nextAction(
  rental: RentalView,
  viewerId: string,
  now = new Date(),
): RentalAction {
  if (same(rental.ownerId, viewerId)) return ownerAction(rental);
  if (same(rental.renterId, viewerId)) return renterAction(rental, now);
  return 'none';
}

const NOTES: Record<
  Exclude<RentalAction, 'none' | 'wait-for-pickup-window'>,
  string
> = {
  'show-pickup-code':
    'Give the renter your pickup code when you hand over the item.',
  'enter-pickup-code':
    "Enter the owner's pickup code when you receive the item.",
  'show-return-code':
    'Give the owner your return code when you bring the item back.',
  'enter-return-code':
    "Enter the renter's return code when you get the item back.",
  'retry-settlement': 'Settlement did not finish. Retry it on the rental page.',
};

/** A short note on the viewer's next step, or null when there is nothing to say. */
export function nextStepNote(
  rental: RentalView,
  viewerId: string,
  now = new Date(),
): string | null {
  const action = nextAction(rental, viewerId, now);
  if (action === 'wait-for-pickup-window') {
    return `Pickup opens on ${formatDateTime(new Date(pickupOpensAt(rental)).toISOString())}.`;
  }
  if (action !== 'none') return NOTES[action];
  if (rental.status === 'CLOSED') return 'Returned and settled.';
  if (rental.status === 'SETTLEMENT_PENDING') {
    return 'The owner accepted the return. Payment is being settled.';
  }
  if (rental.status === 'AWAITING_PICKUP' && same(rental.renterId, viewerId)) {
    return 'The rental period has ended, so the item can no longer be picked up.';
  }
  return null;
}
