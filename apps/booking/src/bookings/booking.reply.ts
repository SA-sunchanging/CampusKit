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
}

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
  };
}
