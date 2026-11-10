/**
 * Messages of libs/contracts/proto/booking.proto as the gRPC loader returns them: camelCase
 * fields, and fields holding the default value (empty string, zero, false, empty list) left out.
 */
export interface DateRangeReply {
  start?: string;
  end?: string;
}

export interface TermsReply {
  rentalFee?: number;
  deposit?: number;
  lateFeePerDay?: number;
}

export interface BookingReply {
  id?: string;
  listingId?: string;
  renterId?: string;
  ownerId?: string;
  status?: string;
  period?: DateRangeReply | null;
  terms?: TermsReply | null;
  declineReason?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string;
}

export interface ListBookingsReply {
  bookings?: BookingReply[];
}

export interface CheckAvailabilityReply {
  available?: boolean;
}
