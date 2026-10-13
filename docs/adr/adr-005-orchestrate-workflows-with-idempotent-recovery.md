# ADR-005: Orchestrate Workflows with Idempotent Recovery

## Status

Accepted.

## Context

Booking confirmation and settlement cross service boundaries. A timeout does not prove failure, and a local rollback cannot undo a completed remote payment. Event choreography would distribute the sequence across services; a dedicated orchestrator would add another deployment. Keeping orchestration with the service responsible for the outcome makes the initial workflows easier to locate and test.

## Decision

Booking orchestrates confirmation and cancellation; Rental orchestrates handover and settlement. Persist each workflow's current step, completed results, and stable operation identifiers before external calls. Payment enforces a unique identifier per financial operation and returns its recorded result on a completed duplicate request. After a timeout, mark the outcome uncertain and reconcile through the adapter before retrying. Resume unfinished steps; compensate for a failed confirmation by reversing successful authorisations and releasing the reservation. Settlement begins after an accepted return and has no dispute-service dependency.

## Consequences

The team must store workflow progress and operation identifiers, implement compensating actions, and test timeouts after remote success. Partial settlement resumes from unfinished steps. Recovery failures need an administrator queue and a documented resolution procedure. Booking and Rental gain additional workflow logic, but completed money operations are not repeated blindly.
