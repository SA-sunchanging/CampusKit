# ADR-005: Orchestrate Workflows with Idempotent Recovery

## Status

Accepted.

## Context

Booking confirmation and settlement cross service boundaries. A timeout does not prove failure, and a local rollback cannot undo a completed remote payment. Event choreography would distribute the sequence across services; a dedicated orchestrator would add another deployment. Keeping orchestration with the service responsible for the outcome makes the initial workflows easier to locate and test.

## Decision

Booking orchestrates confirmation and cancellation; Rental orchestrates handover and settlement. Persist workflow state and stable financial operation identifiers; Payment enforces uniqueness and returns recorded results for completed duplicates. Compensate a failed confirmation by reversing successful authorizations and releasing the reservation. After an accepted return, persist `SETTLEMENT_PENDING`, release the calendar, attempt settlement, and close only after success. Failed settlement remains available for explicit retry. The demo Payment ledger performs local financial changes atomically; real-provider uncertain outcomes, partial settlement, and reconciliation remain production work. Domain transactions write notification events to a transactional outbox for asynchronous delivery through RabbitMQ (see `docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md`); broker failure does not undo committed business state.

## Consequences

Booking and Rental gain workflow and compensation logic. Test duplicate requests, timeouts after remote success, failed confirmation, settlement retry, and broker outage and recovery. Notification delivery may lag without reversing a successful rental operation. The local demo does not demonstrate partial external-provider settlement or a complete administrator reconciliation queue; these require further implementation and operational procedures before production.
