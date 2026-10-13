# ADR-002: Authenticate Centrally, Authorise at the Data Owner

## Status

Accepted.

## Context

Gateway-only authorisation centralises checks but cannot reliably evaluate current resource ownership without duplicating service data. Checking every permission at each service keeps decisions next to the protected resource but adds repeated checks and internal identity configuration. A valid login alone does not establish listing ownership or rental participation.

## Decision

Authenticate at the gateway and propagate a verifiable identity context over authenticated internal connections. Services reject missing or unverifiable context and ignore client-supplied identity headers. At each protected endpoint, check the caller's role and current resource ownership or rental participation before reading or changing data. Deny access by default; internal calls do not bypass these checks.

## Consequences

Resource permissions remain with the owning service. The team must configure trusted identity propagation, secure internal routes, and test forged identities, unauthorised direct calls, and access to another student's records. Every new resource requires an explicit authorisation check.
