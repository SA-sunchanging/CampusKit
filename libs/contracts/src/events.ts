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
 * confirmed and failed (an approval that could not be completed) to both.
 */
export const BOOKING_EVENTS = {
  requested: 'booking.requested',
  declined: 'booking.declined',
  confirmed: 'booking.confirmed',
  failed: 'booking.failed',
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
