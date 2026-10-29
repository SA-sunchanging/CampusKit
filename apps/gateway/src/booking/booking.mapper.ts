import type { BookingStatus } from './booking-status.js';
import type {
  BookingReply,
  CheckAvailabilityReply,
  ListBookingsReply,
} from './booking.reply.js';
import {
  AvailabilityResponse,
  BookingListResponse,
  BookingResponse,
  DateRangeResponse,
  TermsResponse,
} from './booking.response.js';

// The gRPC loader leaves out default values, so every field gets its default back here.

export function toBookingResponse(reply: BookingReply): BookingResponse {
  const period = Object.assign(new DateRangeResponse(), {
    start: reply.period?.start ?? '',
    end: reply.period?.end ?? '',
  });
  const terms = Object.assign(new TermsResponse(), {
    rentalFee: reply.terms?.rentalFee ?? 0,
    deposit: reply.terms?.deposit ?? 0,
    lateFeePerDay: reply.terms?.lateFeePerDay ?? 0,
  });
  return Object.assign(new BookingResponse(), {
    id: reply.id ?? '',
    listingId: reply.listingId ?? '',
    renterId: reply.renterId ?? '',
    ownerId: reply.ownerId ?? '',
    // Booking owns the status values; pass them on as sent.
    status: (reply.status ?? '') as BookingStatus,
    period,
    terms,
    declineReason: reply.declineReason ?? '',
    expiresAt: reply.expiresAt ?? '',
    createdAt: reply.createdAt ?? '',
    updatedAt: reply.updatedAt ?? '',
  });
}

export function toBookingListResponse(
  reply: ListBookingsReply,
): BookingListResponse {
  return Object.assign(new BookingListResponse(), {
    bookings: (reply.bookings ?? []).map(toBookingResponse),
  });
}

export function toAvailabilityResponse(
  reply: CheckAvailabilityReply,
): AvailabilityResponse {
  return Object.assign(new AvailabilityResponse(), {
    available: reply.available ?? false,
  });
}
