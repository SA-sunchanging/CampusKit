# ADR-002: Authenticate Centrally, Authorise at the Data Owner

## Status

Accepted.

## Context

Gateway-only authorisation centralises checks but cannot reliably evaluate current resource ownership without duplicating service data. Checking every permission at each service keeps decisions next to the protected resource but adds repeated checks and internal identity configuration. A valid login alone does not establish listing ownership or rental participation.

## Decision

Student Identity authenticates email/password login and issues JWTs. The gateway and protected services validate JWTs; the gateway propagates the token to REST services and as metadata on gRPC calls. Services ignore client-supplied identity headers and user IDs as evidence of permission. The data-owning service checks the caller's role, ownership, and rental participation. Service-to-service operations require internal service authentication and endpoint-specific permissions; internal calls do not bypass authorisation. Local HTTP and insecure gRPC are restricted to the Docker demo network; TLS is the production transport target.

## Consequences

Resource permissions remain with the owning service. Configure JWT validation, trusted token propagation, internal service credentials, and production TLS; test forged identities, missing or invalid tokens, unauthorised direct calls, and access to another student's records. Email verification and administrator review of student status remain separate eligibility checks. Every new protected resource requires explicit authorisation.
