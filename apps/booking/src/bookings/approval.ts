import type { CallContext } from '../clients/call-context.js';
import type { ServiceFailure } from '../clients/http-call.js';
import type { PaymentClient } from '../clients/payment.client.js';
import type { RentalClient } from '../clients/rental.client.js';
import type { BookingRow } from './booking.row.js';

/** final: the call was refused (a 4xx), so retrying the same calls cannot succeed. */
export type ApprovalOutcome =
  { ok: true; rentalId: string } | { ok: false; error: string; final: boolean };

/** The stable Payment operation ID of one authorization of a booking. */
export function operationId(
  bookingId: string,
  kind: 'FEE' | 'DEPOSIT',
): string {
  return `booking:${bookingId}:authorize-${kind === 'FEE' ? 'fee' : 'deposit'}`;
}

function failure(step: string, result: ServiceFailure): ApprovalOutcome {
  const final = result.reason === 'declined';
  const what = final ? 'was declined' : 'is unavailable';
  return { ok: false, error: `${step} ${what}: ${result.message}`, final };
}

/**
 * The calls that turn an AUTHORIZING booking into a rental: authorize the fee, then the
 * deposit, then create the rental. Every call is idempotent (stable operation IDs, one rental
 * per booking), so a retry repeats them safely. A zero amount is not authorized. Stops at the
 * first failure, describes it, and says whether a retry could still succeed.
 */
export async function authorizeAndCreateRental(
  payment: PaymentClient,
  rental: RentalClient,
  booking: BookingRow,
  call: CallContext,
): Promise<ApprovalOutcome> {
  const amounts = [
    ['FEE', booking.rental_fee],
    ['DEPOSIT', booking.deposit],
  ] as const;
  for (const [kind, amount] of amounts) {
    if (amount === 0) {
      continue;
    }
    const result = await payment.authorize(
      {
        operationId: operationId(booking.id, kind),
        bookingId: booking.id,
        payerId: booking.renter_id,
        payeeId: booking.owner_id,
        kind,
        amount,
      },
      call,
    );
    if (!result.ok) {
      return failure(
        kind === 'FEE' ? 'Fee authorization' : 'Deposit authorization',
        result,
      );
    }
  }
  const created = await rental.create(
    {
      bookingId: booking.id,
      listingId: booking.listing_id,
      ownerId: booking.owner_id,
      renterId: booking.renter_id,
      period: {
        start: new Date(booking.period_start).toISOString(),
        end: new Date(booking.period_end).toISOString(),
      },
      terms: {
        rentalFee: booking.rental_fee,
        deposit: booking.deposit,
        lateFeePerDay: booking.late_fee_per_day,
      },
    },
    call,
  );
  if (!created.ok) {
    return failure('Rental creation', created);
  }
  return { ok: true, rentalId: created.value.id };
}
