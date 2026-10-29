/**
 * Asynchronous event contract (see docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md).
 * Producers: Identity, Listing, Booking, Rental. Consumer: Notification.
 * Change this file only through a PR that the Notification owner and every producer review.
 */
export const EVENTS_EXCHANGE = 'campuskit.events';

export interface EventEnvelope<T = unknown> {
  /** Unique per event; Notification deduplicates on (eventId, recipient). */
  eventId: string;
  /** Dotted name, for example 'booking.confirmed'. The routing key is the same string. */
  type: string;
  /** ISO-8601 UTC timestamp. */
  occurredAt: string;
  correlationId: string;
  /** Name of the producing service. */
  producer: string;
  /** User IDs whose inbox receives the event. */
  recipients: string[];
  data: T;
}

/**
 * Event types Booking publishes. Recipients: requested to the owner, declined to the renter,
 * confirmed and failed (an approval that could not be completed) to both, expired (the owner did
 * not answer in time) and cancelled (a participant cancelled before pickup) to both.
 */
export const BOOKING_EVENTS = {
  requested: 'booking.requested',
  declined: 'booking.declined',
  confirmed: 'booking.confirmed',
  failed: 'booking.failed',
  expired: 'booking.expired',
  cancelled: 'booking.cancelled',
} as const;

export type BookingEventType =
  (typeof BOOKING_EVENTS)[keyof typeof BOOKING_EVENTS];

/** The data of every Booking event. */
export interface BookingEventData {
  bookingId: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  /** Half-open interval [start, end), ISO-8601 UTC. */
  period: { start: string; end: string };
  /** The booking status after the change, for example 'PENDING'. */
  status: string;
}

/**
 * Event types Listing publishes. Recipients: published (directly or after administrator approval)
 * and rejected (an administrator refused it) to the owner.
 */
export const LISTING_EVENTS = {
  published: 'listing.published',
  rejected: 'listing.rejected',
} as const;

export type ListingEventType =
  (typeof LISTING_EVENTS)[keyof typeof LISTING_EVENTS];

/** The data of every Listing event. */
export interface ListingEventData {
  listingId: string;
  ownerId: string;
  title: string;
  /** The listing status after the change, for example 'PUBLISHED'. */
  status: string;
  /** Set on listing.rejected: the administrator's reason. */
  reason?: string;
}

/**
 * Event types Rental publishes. Recipients: started (the renter picked the item up), overdue (the
 * period ended before the return) and closed (the return is settled) to both the owner and the
 * renter; reminded (the period ends within a day) to the renter.
 */
export const RENTAL_EVENTS = {
  started: 'rental.started',
  reminded: 'rental.reminded',
  overdue: 'rental.overdue',
  closed: 'rental.closed',
} as const;

export type RentalEventType =
  (typeof RENTAL_EVENTS)[keyof typeof RENTAL_EVENTS];

/** The data of every Rental event. */
export interface RentalEventData {
  rentalId: string;
  bookingId: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  /** Half-open interval [start, end), ISO-8601 UTC. */
  period: { start: string; end: string };
  /** The rental status after the change, for example 'ACTIVE'. */
  status: string;
  /** Late fee charged at settlement, in satang; 0 until the rental closes. */
  lateFee: number;
}

/** Event types Identity publishes. Recipients: verified (an administrator approved the student) to that student. */
export const IDENTITY_EVENTS = {
  verified: 'identity.verified',
} as const;

export type IdentityEventType =
  (typeof IDENTITY_EVENTS)[keyof typeof IDENTITY_EVENTS];

/** The data of every Identity event. */
export interface IdentityEventData {
  userId: string;
  /** The student status after the change, for example 'VERIFIED'. */
  studentStatus: string;
}
