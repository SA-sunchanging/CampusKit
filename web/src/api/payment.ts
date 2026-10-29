import { api } from './client.ts';

// Payment calls through the gateway (role D). Types follow the gateway's Swagger page
// (tag "payments"). Money is integer satang; times are ISO-8601 UTC. The ledger is a demo:
// no real money moves.
export const AUTHORIZATION_KINDS = ['FEE', 'DEPOSIT'] as const;
export type AuthorizationKind = (typeof AUTHORIZATION_KINDS)[number];

/** EXPIRED is reported, not stored: an AUTHORIZED hold past expiresAt. */
export const AUTHORIZATION_STATUSES = [
  'AUTHORIZED',
  'CAPTURED',
  'SETTLED',
  'VOIDED',
  'EXPIRED',
] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

/** One hold on the renter's money. */
export interface Authorization {
  id: string;
  kind: AuthorizationKind;
  /** The amount held. */
  amount: number;
  /** Taken from the renter. */
  capturedAmount: number;
  /** Given back to the renter. */
  releasedAmount: number;
  status: AuthorizationStatus;
  expiresAt: string;
}

/** Paid to the owner at settlement: the fee plus the late fee taken. */
export interface Payout {
  amount: number;
  payeeId: string;
  paidAt: string;
}

export interface PaymentStatus {
  bookingId: string;
  /** FEE before DEPOSIT; empty when nothing is authorized. */
  authorizations: Authorization[];
  /** Null until the rental is settled. */
  payout: Payout | null;
}

/** The renter or the owner only; anyone else gets 404. */
export function getBookingPayments(bookingId: string): Promise<PaymentStatus> {
  return api(`/payment/payments/bookings/${encodeURIComponent(bookingId)}`);
}

export interface FeeLine {
  amount: number;
  status: AuthorizationStatus;
  /** Taken from the renter (at pickup). */
  charged: number;
}

export interface DepositLine {
  amount: number;
  status: AuthorizationStatus;
  /** Still held on the renter's money. */
  held: number;
  /** Given back to the renter. */
  released: number;
  /** Taken from the deposit as the late fee. */
  charged: number;
}

/** What the payment status means for the renter and the owner. */
export interface PaymentSummary {
  /** Null when the booking has no fee. */
  fee: FeeLine | null;
  /** Null when the booking has no deposit. */
  deposit: DepositLine | null;
  payout: Payout | null;
}

const OPEN: readonly AuthorizationStatus[] = ['AUTHORIZED', 'EXPIRED'];

/** An open hold keeps what was neither taken nor given back; a closed one keeps nothing. */
function heldAmount(hold: Authorization): number {
  if (!OPEN.includes(hold.status)) return 0;
  return Math.max(0, hold.amount - hold.capturedAmount - hold.releasedAmount);
}

/** Splits the holds into the fee and deposit lines shown on the rental page. */
export function summarizePayments(status: PaymentStatus): PaymentSummary {
  const fee = status.authorizations.find((hold) => hold.kind === 'FEE');
  const deposit = status.authorizations.find((hold) => hold.kind === 'DEPOSIT');
  return {
    fee: fee
      ? { amount: fee.amount, status: fee.status, charged: fee.capturedAmount }
      : null,
    deposit: deposit
      ? {
          amount: deposit.amount,
          status: deposit.status,
          held: heldAmount(deposit),
          released: deposit.releasedAmount,
          charged: deposit.capturedAmount,
        }
      : null,
    payout: status.payout,
  };
}
