import type { BookingRow } from './booking.row.js';

/** The proto Booking message, with the camelCase field names of @grpc/proto-loader. */
export interface BookingReply {
  id: string;
  listingId: string;
  renterId: string;
  status: string;
  period: { start: string; end: string };
  ownerId: string;
  terms: { rentalFee: number; deposit: number; lateFeePerDay: number };
  declineReason: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  failureReason: string;
}

const AUTHORIZATION_TOO_SHORT =
  'The authorization must last beyond the rental return; choose earlier dates';

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

/** Maps a bookings row to the proto Booking. decline_reason is empty unless DECLINED. */
export function toBookingReply(row: BookingRow): BookingReply {
  return {
    id: row.id,
    listingId: row.listing_id,
    renterId: row.renter_id,
    status: row.status,
    period: { start: iso(row.period_start), end: iso(row.period_end) },
    ownerId: row.owner_id,
    terms: {
      rentalFee: row.rental_fee,
      deposit: row.deposit,
      lateFeePerDay: row.late_fee_per_day,
    },
    declineReason: row.status === 'DECLINED' ? (row.decline_reason ?? '') : '',
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    // Expose only a known public code; internal errors may contain private service details.
    failureReason:
      row.status === 'FAILED' &&
      row.last_error?.includes(AUTHORIZATION_TOO_SHORT)
        ? 'AUTHORIZATION_EXPIRES_BEFORE_RETURN'
        : '',
  };
}
