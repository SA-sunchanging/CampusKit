# ADR-003: Prevent Overlapping Reservations with Database Constraints

## Status

Accepted.

## Context

Owner blackouts, pending requests, and confirmed bookings compete for one item. An application-level check followed by an insert can race under concurrent requests. Serialising requests with a distributed lock adds lease and recovery complexity. A PostgreSQL exclusion constraint enforces non-overlap at the storage boundary but requires range modelling and conflict handling.

## Decision

Keep the authoritative calendar in Booking. Represent blocking periods as half-open intervals [start, end), and enforce non-overlap for the same item with a PostgreSQL GiST exclusion constraint on item identity and the time range (using btree_gist for scalar identity). Store owner blackouts and active reservations in the constrained calendar. Create or change a reservation within one transaction; convert a constraint conflict into an unavailable-dates response. Expiry or cancellation explicitly removes the blocking interval in a transaction. Listing publication waits for calendar setup, and search availability remains advisory.

## Consequences

The database prevents overlapping committed periods even when requests arrive together. Back-to-back rentals are permitted by half-open intervals. The team must test simultaneous overlapping inserts, adjacent intervals, owner blackout changes, and expiry-versus-confirmation races. An expiry worker releases stale reservations; a delayed worker can temporarily reduce availability but must not allow double booking. Booking remains a dependency for publication and reservation.
