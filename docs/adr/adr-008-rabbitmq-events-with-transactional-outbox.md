# ADR-008: RabbitMQ Events with Transactional Outbox and Idempotent Inbox

## Status

Accepted.

## Context

Notifications must not make successful rental operations fail when delivery is unavailable. Direct synchronous notification calls couple business transactions to delivery. Publishing independently of database commits can lose events or announce uncommitted changes. A transactional outbox adds publisher and consumer work but keeps events consistent with domain state.

## Decision

Identity, Listing, Booking, and Rental write outbox events in the same PostgreSQL transaction as the relevant domain state. A publisher sends persistent events to a durable RabbitMQ exchange and marks the outbox entry sent only after publisher confirmation. Notification consumes a durable queue and upserts MongoDB inbox documents before acknowledging delivery. A unique (`eventId`, `recipient`) index deduplicates redelivery. Malformed events go to a dead-letter queue; transient storage failures are requeued. The current delivery channel is the in-app inbox; external email and push remain deferred.

## Consequences

Broker delivery is at least once; the unique inbox index ensures one record per event and recipient. Broker or storage outages may delay notifications, which resume after recovery without reversing committed business operations. Test broker outage, publisher confirmation, consumer acknowledgement, and duplicate deliveries. Queue retention, bounded retry and backoff, dead-letter recovery, broker high availability, and external delivery operations require further operational work.
