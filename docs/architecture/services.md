# Services

CampusKit has seven business services behind one API Gateway. Each service owns a separate logical database and credentials. The gateway validates and propagates JWTs and routes REST and gRPC requests; it contains no business logic. The data-owning service enforces role, ownership, and participation (see `docs/adr/adr-002-authenticate-centrally-authorise-at-data-owner.md`). Scheduled operations are background jobs inside the owning service.

The React + TypeScript web app serves both students and administrators and calls only the gateway, over REST.

## External systems

All production integrations are deferred. The demo substitutes a local component for each.

| External system | Demo substitute |
|---|---|
| Payment Gateway | Local ledger adapter inside Payment, with no real money. Provider selection is deferred (see `docs/adr/adr-006-isolate-payment-integration-behind-adapter.md`). |
| University Identity Provider | Email verification code (shown on the UI in demo mode) plus administrator review of student status. |
| Email & Push Providers | MongoDB in-app inbox in Notification, filled from RabbitMQ events. |
| Object Storage (S3) | Compressed inline data URLs for photographs. Signed upload and download URLs are a future integration. |

## Service catalogue

Operation labels describe responsibilities, not exact endpoint names.

| Service | Responsibility | Current operations | Collaborators and delivery | Protocol | Database |
|---|---|---|---|---|---|
| **Student Identity** | Authentication, verification, eligibility | Register and log in; verify email; administrator student verification; check eligibility and profile | Gateway validates and propagates the JWT. Other services query eligibility and profile. Writes notification outbox events. | REST | PostgreSQL `identity_db` |
| **Listing** | Items, pricing, screening | Create a safe DRAFT; search, detail, quote; moderation; publish and unpublish | Identity: eligibility and payout profile. Booking: calendar setup and availability (gRPC). Review: reputation summary. Outbox events. | REST; gRPC client | PostgreSQL `listing_db` |
| **Booking** | Authoritative calendar and agreed terms | Set calendar; check availability; request, approve, decline, cancel booking; release calendar; scheduled expiry and compensation | Identity: eligibility. Listing: detail and quote. Payment: authorize and void. Rental: create and cancel. Outbox events. | gRPC server; REST client | PostgreSQL `booking_db` |
| **Rental** | Custody and settlement workflow | Pickup and return evidence and codes; confirm pickup and return; settlement and retry; scheduled overdue checks and reminders | Booking: status, calendar release, affected bookings (gRPC). Payment: capture and settle. Outbox events. Closes after successful settlement. | REST; gRPC client | PostgreSQL `rental_db` |
| **Payment** | Demo ledger and payment adapter | Payment method; fee and deposit authorization; capture; void and refund; late-fee settlement; payout | Local ledger adapter; no real provider calls. Stable financial operation IDs prevent duplicates. Booking and Rental publish the related notifications. | REST | PostgreSQL `payment_db` |
| **Review and Reputation** | Participant reviews | Submit review; read reputation summary | Rental: verify CLOSED status and participation before accepting a review. No review notification event in the current scope. | REST | MongoDB `review_db` |
| **Notification** | Event delivery and inbox | Consume events; upsert and list inbox; reconnect after broker failure | RabbitMQ durable queue → MongoDB inbox. Acknowledge after storage; deduplicate on (`eventId`, `recipient`); dead-letter malformed events. | RabbitMQ consumer; REST inbox | MongoDB `notification_db` |

### Deferred capabilities

- Student Identity: account-restriction management, erasure, identity-document purge, and pseudonymisation remain proposed operations.
- Booking: calendar reconciliation is separate from the implemented request-expiry and compensation worker, and is deferred.
- Rental: settlement holds and dispute workflows are deferred.
- Payment: real-provider reconciliation is deferred.
- Notification: external contacts and delivery retry are deferred.
- Damage and loss claims and dispute adjudication have no service or database in this iteration.

### Database choice

PostgreSQL supports transactional reservations, custody, and financial records; Booking also needs range and exclusion constraints. MongoDB stores each review or inbox entry as a document and supports compound unique indexes for business-level deduplication. This is a suitable course choice, not a claim that relational storage could not handle these records. Two database technologies add index, credential, backup, and recovery work. Shared local instances reduce setup cost but remain infrastructure failure points (see `docs/adr/adr-004-database-per-service.md`).

Seven services demonstrate independent ownership and deployment; for a five-person team they also increase contract-testing and recovery work. One shared Compose configuration and a reduced feature scope keep that cost manageable (see `docs/adr/adr-001-decompose-by-business-capability.md`).

## Container view (C4 level 2)

Solid edges are synchronous calls. Dashed edges are asynchronous events.

```mermaid
flowchart LR
  user(["Student / Admin"])
  web["Web app<br/>React + TypeScript"]
  gateway{{"API Gateway<br/>JWT + routing"}}

  subgraph svc ["Business services"]
    identity{{"Student Identity"}}
    listing{{"Listing"}}
    booking{{"Booking"}}
    rental{{"Rental"}}
    payment{{"Payment"}}
    review{{"Review and Reputation"}}
    notification{{"Notification"}}
  end

  mq[["RabbitMQ<br/>durable exchange / queue"]]

  identityDb[("PostgreSQL<br/>identity_db")]
  listingDb[("PostgreSQL<br/>listing_db")]
  bookingDb[("PostgreSQL<br/>booking_db")]
  rentalDb[("PostgreSQL<br/>rental_db")]
  paymentDb[("PostgreSQL<br/>payment_db")]
  reviewDb[("MongoDB<br/>review_db")]
  notificationDb[("MongoDB<br/>notification_db")]

  user --> web
  web -- "REST" --> gateway
  gateway -- "REST" --> identity
  gateway -- "REST" --> listing
  gateway -- "gRPC" --> booking
  gateway -- "REST" --> rental
  gateway -- "REST" --> payment
  gateway -- "REST" --> review
  gateway -- "REST" --> notification

  listing -- "REST" --> identity
  listing -- "gRPC" --> booking
  listing -- "REST" --> review
  booking -- "REST" --> identity
  booking -- "REST" --> listing
  booking -- "REST" --> payment
  booking -- "REST" --> rental
  rental -- "gRPC" --> booking
  rental -- "REST" --> payment
  review -- "REST" --> rental

  identity -. "outbox event" .-> mq
  listing -. "outbox event" .-> mq
  booking -. "outbox event" .-> mq
  rental -. "outbox event" .-> mq
  mq -. "consume" .-> notification

  identity --> identityDb
  listing --> listingDb
  booking --> bookingDb
  rental --> rentalDb
  payment --> paymentDb
  review --> reviewDb
  notification --> notificationDb
```

## Sequences

Protected requests carry JWTs; the data-owning service checks role, ownership, or participation. The event path is the asynchronous path below, not a synchronous Notification call.

### Publish an equipment listing

```mermaid
sequenceDiagram
  participant O as Owner via Gateway
  participant L as Listing (REST)
  participant I as Identity (REST)
  participant B as Booking (gRPC)
  participant E as Event / inbox path
  O->>L: Submit listing (JWT)
  L->>I: Check eligibility / payout profile
  L->>L: Validate; save DRAFT
  L->>B: Set up calendar
  B-->>L: Calendar setup succeeds
  L->>L: Publish, or pending review
  L--)E: Domain state + outbox; publish after commit
```

Moderated listings publish after approval; invalid input is rejected. Calendar failure keeps the listing unpublished. Broker failure delays the inbox.

### Book and pay for a rental

```mermaid
sequenceDiagram
  participant P as Parties via Gateway
  participant B as Booking (gRPC)
  participant Pay as Payment (REST)
  participant R as Rental (REST)
  participant E as Event / inbox path
  P->>B: Request booking (JWT)
  B->>B: Eligibility / quote checks (Identity, Listing via REST)
  B->>B: Atomic reservation; PENDING
  P->>B: Owner approves
  B->>Pay: Authorize fee + deposit
  Pay-->>B: Authorization result
  B->>R: Create rental (idempotent)
  R-->>B: Rental created
  B--)E: CONFIRMED + outbox → notification
```

Failed authorization: retry within the window; expiry releases the dates and voids holds. Failed confirmation: compensate payment and reservation; track unresolved recovery.

### Handover, return, and settlement

```mermaid
sequenceDiagram
  participant P as Parties via Gateway
  participant R as Rental (REST)
  participant B as Booking (gRPC)
  participant Pay as Payment (REST)
  participant Rv as Review (REST)
  P->>R: Pickup evidence + renter confirms owner code
  R->>B: Recheck booking
  R->>Pay: Capture fee (deposit stays reserved)
  Pay-->>R: Capture succeeds; record ACTIVE
  P->>R: Return evidence + owner accepts renter code
  R->>R: SETTLEMENT_PENDING
  R->>B: Release calendar
  R->>Pay: Settle late fee, deposit, payout
  Pay-->>R: Settlement succeeds; CLOSED
  P->>Rv: Submit participant review
  Rv->>R: Check CLOSED + participant
```

Rental commits also write outbox events. Settlement failure keeps custody and `SETTLEMENT_PENDING` for explicit retry.

### Asynchronous notification delivery

```mermaid
sequenceDiagram
  participant Pr as Producer + PG outbox
  participant MQ as RabbitMQ
  participant N as Notification consumer
  participant M as MongoDB inbox
  Pr->>Pr: Commit state + outbox
  Pr--)MQ: Publish persistent event
  MQ--)Pr: Publisher confirm → mark sent
  MQ--)N: Deliver event (at least once)
  N->>M: Upsert (eventId, recipient)
  M-->>N: Stored or already exists
  N--)MQ: Acknowledge
```

Identity, Listing, Booking, and Rental produce events. Duplicate delivery does not create a second inbox record. Malformed events go to a dead-letter queue; transient storage failures are requeued. Broker outages delay the inbox without reversing committed business state. Review and Payment publish no notification events in the current scope (see `docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md`).

## Booking rules and calls to Payment and Rental

Booking implements the request and approval steps of the booking sequence above in `apps/booking`. The Payment and Rental endpoints below are a contract that Booking proposes; their owners still have to confirm it, and both services answer with stubs today.

### Booking status

| Status | Meaning |
|---|---|
| `PENDING` | The renter asked; the dates are reserved. The request expires at the earlier of 24 hours after it was made and the start of the period. |
| `AUTHORIZING` | The owner approved; Booking is authorizing the payments and creating the rental. The dates stay reserved and the booking never expires on its own. |
| `CONFIRMED` | The fee and deposit are authorized and the rental exists. Rental releases the dates after the return. |
| `DECLINED` | The owner refused, with an optional reason of at most 500 characters. The dates are released. |
| `EXPIRED` | The owner did not answer in time. The dates are released. |
| `CANCELLED` | Reserved for cancellation, which is not built yet. |

- A request needs whole Bangkok days that start after now and end within 366 days, an eligible renter (Identity), a published listing (Listing quote), and a renter who is not the owner. A renter holds at most five `PENDING` or `AUTHORIZING` requests at once.
- Expiry is lazy for now: a stale `PENDING` booking becomes `EXPIRED` and frees its dates when a request, approval, decline, get or list touches it.
- Only the renter and the owner can read a booking; anyone else gets `NOT_FOUND`. Only the owner approves or declines.
- `booking.requested` goes to the owner, `booking.declined` to the renter and `booking.confirmed` to both. Booking writes them to its own outbox table in the same transaction and a relay publishes them (see `docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md`); the data shape is in `libs/contracts/src/events.ts`.

### Approval calls

When the owner approves, Booking makes these calls in order. Each carries the `x-correlation-id` header and counts as failed after 5 seconds. A zero amount is not authorized.

| Order | Call | Body | Success reply | Repeating it |
|---|---|---|---|---|
| 1 | `POST /internal/payments/authorize` on Payment | `{ operationId, bookingId, payerId, payeeId, kind: "FEE", amount }` | 2xx `{ id, status }` | Same `operationId`, `booking:<booking id>:authorize-fee`, so Payment authorizes once |
| 2 | `POST /internal/payments/authorize` on Payment | Same, with `kind: "DEPOSIT"` | 2xx `{ id, status }` | `operationId` is `booking:<booking id>:authorize-deposit` |
| 3 | `POST /internal/rentals` on Rental | `{ bookingId, listingId, ownerId, renterId, period: { start, end }, terms: { rentalFee, deposit, lateFeePerDay } }` | 2xx `{ id }` | Rental keeps one rental per `bookingId` and returns it again |

`payerId` is the renter and `payeeId` the owner; amounts are integer satang, and times are ISO-8601 UTC. A refusal is a 4xx with the shared error body `{ error: { code, message } }`.

If a call fails, the booking stays `AUTHORIZING` and the reason is stored with it: a 4xx other than 404 counts as a decline, while 404, 501, 5xx, a timeout or no connection counts as unavailable. The approval still answers successfully with status `AUTHORIZING`. The owner approves again to retry the same calls with the same operation IDs, until the period starts. When all three succeed, the booking becomes `CONFIRMED` and stores the rental ID. Voiding the authorizations of a booking that never confirms is deferred with the expiry worker.

## Gateway rules

The gateway checks every request under `/api`, both the proxied REST services and its own Booking routes, in this order:

1. **Correlation ID.** The gateway keeps the caller's `x-correlation-id` when it is 1 to 128 characters of letters, digits, `.`, `_`, or `-`; otherwise it creates a UUID. It forwards the ID to the service and returns it in the response.
2. **Internal paths.** Any path with an `internal` segment, in any case or percent-encoding, answers `404` and is never forwarded.
3. **Identity headers.** Client headers that start with `x-user-`, `x-auth-`, or `x-role`, and `x-forwarded-user`, are removed. Services take the caller's identity only from the JWT.
4. **Token.** Only these routes are public: `POST /api/identity/accounts` (register), `POST /api/identity/auth/login`, `GET /api/listing/listings` (search) and `GET /api/listing/listings/{id}` (detail, lowercase UUID only), so guests can browse before they register, and `GET /api/<service>/health`. Public routes ignore the `Authorization` header but still forward it; listing detail uses a valid token to show the owner their own DRAFT. Every other route needs `Authorization: Bearer <JWT>`, signed with HS256 and carrying a UUID `sub`, a `role` of `student` or `admin`, and an `exp`. A missing token answers `401` with `Missing bearer token`; a wrong, expired, or forged token answers `401` with `Invalid token`.

When a service is down or does not answer within 15 seconds, the gateway answers `502` with `The <service> service is unavailable`.

The gateway forwards the `Authorization` header unchanged, and each service still checks the token and authorises the request (see `docs/adr/adr-002-authenticate-centrally-authorise-at-data-owner.md`).

The gateway serves the Booking routes itself and calls Booking over gRPC (`libs/contracts/proto/booking.proto`). Every Booking route needs a token. On each call the gateway sends the caller's `Authorization` header and the correlation ID as the gRPC metadata `authorization` and `x-correlation-id`; Booking reads the caller from the token. `SetupCalendar` and `ReleaseCalendar` have no REST route; Listing and Rental call them over gRPC.

| Route | Booking method | Answer |
|---|---|---|
| `POST /api/booking/bookings` with `{ listingId, period: { start, end } }` | `RequestBooking` | `201` with the booking |
| `GET /api/booking/bookings?role=&status=` (`role` is `renter` or `owner`; `status` is optional) | `ListBookings` | `200` with `{ bookings }`, newest first |
| `GET /api/booking/bookings/{id}` | `GetBooking` | `200` with the booking |
| `POST /api/booking/bookings/{id}/approve` | `ApproveBooking` | `200` with the booking |
| `POST /api/booking/bookings/{id}/decline` with an optional `{ reason }` of at most 500 characters | `DeclineBooking` | `200` with the booking |
| `GET /api/booking/listings/{listingId}/availability?start=&end=` | `CheckAvailability` | `200` with `{ available }` |

A booking in a response has `id`, `listingId`, `renterId`, `ownerId`, `status`, `period` `{ start, end }`, `terms` `{ rentalFee, deposit, lateFeePerDay }` in satang, `declineReason` (empty unless `DECLINED`), `expiresAt`, `createdAt`, and `updatedAt`; every field is present, with an empty string or zero when Booking left it unset.

The gateway validates IDs as UUIDs and times as ISO-8601 before it calls Booking, and answers `400` otherwise; Booking checks the rules. Booking's gRPC status codes become HTTP statuses as `apps/gateway/src/booking/grpc-error.ts` lists them. When Booking does not answer within 10 seconds, or reports `DEADLINE_EXCEEDED`, the gateway answers `504` with `The booking service did not answer in time`.

## Service discovery and local deployment

Docker Compose DNS resolves service names inside the Compose network. Services read endpoint addresses from environment configuration instead of hard-coding container IPs. The gateway translates client REST requests to Booking gRPC where needed; Listing and Rental also call Booking through gRPC.

| Service | Address | Protocol | Code |
|---|---|---|---|
| API Gateway | `gateway:3000` | REST (public) | `apps/gateway` |
| Student Identity | `identity:3001` | REST | `apps/identity` |
| Listing | `listing:3002` | REST | `apps/listing` |
| Booking | `booking:50051` | gRPC (HTTP `booking:3007` serves only health and docs) | `apps/booking` |
| Rental | `rental:3003` | REST | `apps/rental` |
| Payment | `payment:3004` | REST | `apps/payment` |
| Review and Reputation | `review:3005` | REST | `apps/review` |
| Notification | `notification:3006` | REST inbox; RabbitMQ consumer | `apps/notification` |

The local deployment uses one PostgreSQL instance and one MongoDB instance with separate logical databases and credentials per service, plus persistent volumes. There is no external service registry and no multi-instance gRPC balancing. Volumes alone do not prove backup and restore targets; RPO/RTO, TLS, and load and usability testing remain acceptance or production targets (see `docs/requirements.md`).

## Collaboration checks

These are a validation plan, not claimed test results.

- Listing publication: validate before saving a DRAFT; calendar setup must succeed before publication.
- Booking: prevent overlapping committed reservations; retry authorization within its window and compensate for a failed confirmation.
- Handover and settlement: keep the deposit after fee capture; accept evidence and code at return, release the calendar, settle, then close.
- Review requires a CLOSED rental and participant authorization.
- Verify broker outage and recovery and duplicate event delivery separately from payment-workflow recovery.

## Open questions

- **Internal service authentication is not specified.** `docs/adr/adr-002-authenticate-centrally-authorise-at-data-owner.md` requires internal service credentials for service-to-service calls but does not choose a mechanism. Until one is chosen, the gateway refuses every `/internal/` path from outside, but inside the Compose network internal endpoints accept calls without credentials.
