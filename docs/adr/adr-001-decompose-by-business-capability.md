# ADR-001: Decompose by Business Capability

## Status

Accepted.

## Context

CampusKit has a five-person team and one term to deliver independent services. A modular monolith offers simpler deployment and local transactions; microservices make independent deployment and failure recovery explicit but require more contracts and operations. Use service decomposition as the course architecture, with business responsibilities listed here as boundaries rather than as separate ADRs.

## Decision

Use seven independently deployable services: Student Identity, Listing, Booking, Rental, Payment, Review and Reputation, and Notification, behind one API gateway. Student Identity owns verification and account standing. Each service exposes APIs and owns its database; no service reads another service's tables. Report handling and dispute adjudication are deferred and have no service in this iteration.

## Consequences

Separate deployment and data ownership support the course's architecture goals. The team must assign owners to seven services, maintain API contracts and a common local startup configuration, and test cross-service failures with correlated logs. This accepts more operational work than a modular monolith; reducing the feature scope is necessary to keep the course implementation manageable.
