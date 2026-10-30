# ADR-010: Authenticate Internal Calls with Short-Lived Service Tokens

## Status

Accepted.

## Context

Services call each other's `/internal/` REST endpoints (for example Payment authorize and capture, Rental creation, Identity eligibility) and the service-only methods of the Booking gRPC service. `docs/adr/adr-002-authenticate-centrally-authorise-at-data-owner.md` requires internal service credentials and endpoint-specific permissions for these calls, but does not choose a mechanism. Today the gateway refuses every `/internal/` path from outside, so the only protection is the Compose network; `docs/architecture/risk-matrix.md` records that any process inside the network can call Payment capture as a medium risk. Some internal calls also forward the user's JWT, so a service credential must travel next to the user token, not replace it.

The forces are: a compromised or misbehaving process inside the network must not move money or create rentals; each endpoint should accept only the services that need it; the mechanism must run in the local Docker Compose demo without a certificate authority or a secrets manager; and the team already validates HS256 JWTs in every NestJS service.

The options considered were:

- **Network isolation only.** Nothing to build, but every process on the network is trusted, a leaked container gives full access, and nothing limits which service may call which endpoint.
- **A shared static header.** One secret string in a header is simple, but it never expires, a leak stays valid until every service is redeployed, and it does not say which service is calling, so per-endpoint allowlists are impossible.
- **Mutual TLS.** Strong identity at the transport layer, but it needs a certificate authority, certificate issue and rotation for every service, and TLS on every HTTP and gRPC listener, which is more operational work than the course demo can carry.
- **Short-lived service JWTs.** Each service signs a token that names itself, with a short expiry and an audience that only internal calls accept. It reuses the JWT library and validation the services already have, and lets each endpoint allow named callers; it still relies on one shared signing secret and adds clock and configuration dependencies.

## Decision

We will authenticate every service-to-service call with a short-lived service JWT that names the calling service, sent in its own header so the user's `Authorization` header stays free. Tokens are signed with an internal secret that is separate from the user JWT secret and are accepted only with the internal audience. Every internal REST endpoint and every Booking gRPC method that only services call accepts a token only from the services on its allowlist: a missing or invalid token is unauthenticated, and a valid token from a service not on the list is forbidden. Calls the gateway makes for a user keep relying on the user JWT. Health checks and API documentation stay open. Internal calls still do not bypass the data owner's own authorisation rules.

## Consequences

A process inside the network can no longer call internal endpoints without the internal secret, and a service can call only the endpoints its allowlist grants, which narrows the damage of a compromised container. A leaked token expires within minutes. The shared signing secret remains a single point of compromise: anyone holding it can sign as any service, so it must be kept out of the repository and rotated together on every service; asymmetric keys per service would remove this and are a possible later step. Services depend on roughly synchronised clocks. Every new internal endpoint or caller needs an allowlist entry, or the call fails with forbidden. Test token signing, expiry and refresh, rejection of missing, forged, expired, and wrong-audience tokens, rejection of callers outside the allowlist, and that every outgoing internal call sends a token. Transport encryption (TLS) remains a production target.
