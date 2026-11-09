# Services

CampusKit has seven business services behind one API Gateway. Each service owns a separate logical database and credentials. The gateway validates and propagates JWTs and routes REST and gRPC requests; it contains no business logic. The data-owning service enforces role, ownership, and participation (see `docs/adr/adr-002-authenticate-centrally-authorise-at-data-owner.md`). Scheduled operations are background jobs inside the owning service.

The React + TypeScript web app serves both students and administrators and calls only the gateway, over REST.

## External systems

All production integrations are deferred. The demo substitutes a local component for each.

| External system              | Demo substitute                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment Gateway              | Local ledger adapter inside Payment, with no real money. Provider selection is deferred (see `docs/adr/adr-006-isolate-payment-integration-behind-adapter.md`). |
| University Identity Provider | Email verification code (shown on the UI in demo mode) plus administrator review of student status.                                                             |
| Email & Push Providers       | MongoDB in-app inbox in Notification, filled from RabbitMQ events.                                                                                              |
| Object Storage (S3)          | Compressed inline data URLs for photographs. Signed upload and download URLs are a future integration.                                                          |

## Service catalogue

Operation labels describe responsibilities, not exact endpoint names.

| Service                   | Responsibility                            | Current operations                                                                                                                                                             | Collaborators and delivery                                                                                                                             | Protocol                      | Database                  |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------- |
| **Student Identity**      | Authentication, verification, eligibility | Register and log in; verify email with a one-time code; submit and review student status; check eligibility and profile                                                        | Gateway validates and propagates the JWT. Other services query eligibility and profile. Outbox events.                                                 | REST                          | PostgreSQL `identity_db`  |
| **Listing**               | Items, pricing, screening                 | Create a DRAFT and publish it; screen and moderate; unpublish; search, detail, quote                                                                                           | Identity: eligibility and profile. Booking: calendar setup and availability filter (gRPC). Review: owner reputation. Outbox events.                    | REST; gRPC client             | PostgreSQL `listing_db`   |
| **Booking**               | Authoritative calendar and agreed terms   | Set calendar; check availability; request, approve, decline, cancel booking; expire stale requests; release calendar; fail approvals that cannot complete and void their holds | Identity: eligibility. Listing: quote. Payment: authorize and void. Rental: create and cancel. Outbox events.                                          | gRPC server; REST client      | PostgreSQL `booking_db`   |
| **Rental**                | Custody and settlement workflow           | Pickup and return evidence and codes; confirm pickup and return; settlement and retry; cancel before pickup; scheduled overdue checks and reminders                            | Booking: status, calendar release, affected bookings (gRPC). Payment: capture and settle. Outbox events. Closes after successful settlement.           | REST; gRPC client             | PostgreSQL `rental_db`    |
| **Payment**               | Demo ledger and payment adapter           | Payment method; fee and deposit authorization; capture; void; late-fee settlement; payout                                                                                      | Local ledger adapter; no real provider calls. Stable financial operation IDs prevent duplicates. Booking and Rental publish the related notifications. | REST                          | PostgreSQL `payment_db`   |
| **Review and Reputation** | Participant reviews                       | Submit review; list a user's received reviews and a rental's reviews; reputation summary                                                                                       | Rental: verify CLOSED status and participation before accepting a review. No review notification event in the current scope.                           | REST                          | MongoDB `review_db`       |
| **Notification**          | Event delivery and inbox                  | Consume events; upsert and list inbox; store dead letters for administrators; reconnect after broker failure                                                                   | RabbitMQ durable queue → MongoDB inbox. Acknowledge after storage; deduplicate on (`eventId`, `recipient`); dead-letter malformed events.              | RabbitMQ consumer; REST inbox | MongoDB `notification_db` |

### Deferred capabilities

- Student Identity: account-restriction management, erasure, identity-document purge, and pseudonymisation remain proposed operations.
- Listing: editing or resubmitting a rejected listing, and checking more than the 200 newest matches of a date search, are deferred.
- Booking: calendar reconciliation and rescheduling after a late return are deferred.
- Rental: settlement holds and dispute workflows are deferred.
- Payment: refunds and real-provider reconciliation are deferred.
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
  L->>L: Screen value and wording
  alt Not flagged
    L->>L: PUBLISHED
    L--)E: listing.published (outbox)
  else Flagged
    L->>L: PENDING_REVIEW
    Note over L: An administrator approves or rejects
    L--)E: listing.published or listing.rejected (outbox)
  end
```

Invalid input is rejected before anything is saved. Calendar failure keeps the listing a DRAFT that the owner can publish again. Publishing or approval writes `listing.published` to the owner in the same transaction; rejection writes `listing.rejected` with the reason (see Listing rules below).

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

Unavailable Payment or Rental: the booking stays `AUTHORIZING` and the owner retries until the period starts. A refusal, or a period that starts first, makes the booking `FAILED`: the dates are released and Payment voids the holds (see Booking rules below).

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

The commit to `ACTIVE` writes `rental.started` and the commit to `CLOSED` writes `rental.closed`, both to the owner and the renter. While the rental is `ACTIVE`, a scheduled sweep writes `rental.reminded` before the period ends and `rental.overdue` once it has ended (see Rental rules below). Settlement failure keeps custody and `SETTLEMENT_PENDING` for explicit retry.

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

Identity, Listing, Booking, and Rental produce events through the shared outbox in `libs/messaging`. Duplicate delivery does not create a second inbox record. Malformed events go to a dead-letter queue, which Notification stores for administrators; transient storage failures are requeued. Broker outages delay the inbox without reversing committed business state. Review and Payment publish no notification events in the current scope (see `docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md`).

## Student Identity verification

Identity runs email and student verification in `apps/identity`. The eligibility rules do not change.

- **Payout details.** Students set their PromptPay destination on the Account page. `PUT /accounts/me/payout-profile` accepts `{ method: 'PROMPTPAY', promptPayId, accountName }` and returns the saved details; administrators receive `403`. The ID must be a 10-digit mobile number starting with 0 or a 13-digit national ID, and the trimmed name must contain 1 to 100 characters. The caller's profile, including `GET /accounts/me` and verification responses, includes nullable `payoutProfile` so settings survive reloads. A payout destination is required for publishing, not booking. The demo records payments without transferring real money.
- **Email code.** `POST /accounts/me/email-verification` answers `201` with `{ expiresAt }`, plus `demoCode` when `DEMO_MODE=true`. The code is six digits from a cryptographic random source, stored as an HMAC-SHA-256 bound to the account ID with `VERIFICATION_CODE_SECRET`, and valid for 15 minutes and five tries. A new code within 60 seconds of the last answers `429`.
- **Confirm.** `POST /accounts/me/email-verification/confirm` with `{ code }` answers `200` with the profile. A missing, expired, or used-up code answers `410`; a wrong code answers `400` with the tries left; an already verified email answers `409`.
- **Student status.** `POST /accounts/me/student-status` with a ten-digit `{ studentId }` needs a verified email and the student role, and moves `UNSUBMITTED` or `REJECTED` to `PENDING`.
- **Administrator review.** `GET /admin/students?status=PENDING&page=&pageSize=` lists submissions oldest first (`pageSize` at most 50). `POST /admin/students/{id}/approve` sets `VERIFIED` and writes `identity.verified` to the student through the outbox in the same transaction; `POST /admin/students/{id}/reject` with a `{ reason }` of 1 to 300 characters sets `REJECTED` without an event. Another status answers `409`.

## Listing rules and endpoints

Listing runs the publication step of the publish sequence above in `apps/listing`. Money is integer satang, times are ISO-8601 UTC, and date ranges are half-open whole Bangkok days.

### Listing status

| Status           | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `DRAFT`          | Saved, but Booking has not set up the calendar yet. `publishError` says why.                |
| `PENDING_REVIEW` | The calendar exists, but screening flagged the listing; it waits for an administrator.      |
| `PUBLISHED`      | The calendar exists; the listing shows in search and can be quoted.                         |
| `REJECTED`       | An administrator refused it with a reason of 1 to 300 characters. It cannot be resubmitted. |
| `UNPUBLISHED`    | The owner took a published listing down. It cannot be published again.                      |

Only `PUBLISHED` listings are searchable and quotable. A listing in any other status is visible only to its owner and administrators.

### Create and publish

1. Identity checks that the caller may publish (`canPublish`) and gives the owner's display name. Not eligible answers `403`; Identity down answers `503`.
2. Listing checks the body: title, category, condition, accessories, replacement value, daily rate (at most 100,000 THB), deposit, late fee, at most 30 rental days, pickup points, at most 10 unavailable periods within 366 days, and one to five photos.
3. The DRAFT and its photos are saved in one transaction.
4. Listing calls `SetupCalendar` on Booking over gRPC with the owner's token and the unavailable periods. On failure the listing stays a DRAFT with `publishError`, and `POST /listings/{id}/publish` tries again (owner only, rechecks eligibility, changes nothing for a `PUBLISHED` or `PENDING_REVIEW` listing, and answers `409` for `REJECTED` or `UNPUBLISHED`).
5. On success, screening decides: a flagged listing becomes `PENDING_REVIEW` with no event; any other becomes `PUBLISHED` and writes `listing.published`.

### Screening and moderation

`apps/listing/src/listings/moderation-rules.ts` flags a listing whose replacement value is at least 10,000 THB, or whose title or description names weapons, drugs, alcohol, vapes, or counterfeit goods (English words match whole words; Thai words match anywhere). The reasons are kept in `moderation_flags` for the administrator's queue. An administrator approves a `PENDING_REVIEW` listing, which becomes `PUBLISHED` and writes `listing.published`, or rejects it with a reason, which makes it `REJECTED` and writes `listing.rejected`. The owner unpublishes a `PUBLISHED` listing with no event.

Photos are inline data URLs (JPEG, PNG or WebP), at most 400 KB each and 60 KB for the thumbnail. The web app resizes and compresses them before upload; search returns only the thumbnail.

### Search

- `start` and `end` come together, as strict ISO-8601, with `end` after `start` and at most 30 days apart; otherwise `400`.
- With dates, Listing takes the 200 newest matches of the other filters, asks Booking `FilterAvailable` once, keeps their order and pages in memory; `total` counts the free ones among them. Booking down or slower than 5 seconds answers `503`. Without dates Listing never calls Booking.
- `FilterAvailable` is advisory, takes no user token (guests search too) but requires Listing's service token, accepts at most 200 IDs, and treats a listing without a calendar as unavailable.
- Each search item and the detail carry `ownerRating` (null without reviews) and `ownerReviewCount`, from one Review `GET /internal/reputation` call per request with a 1.5-second timeout. When Review fails they are null and 0, a warning is logged, and the request still succeeds.

### Endpoints

| Route                                                              | Caller        | Answer                                                                                                                                                                            |
| ------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /listings?q=&category=&location=&start=&end=&page=&pageSize=` | Public        | `200` with `{ items, total, page, pageSize }`; only `PUBLISHED` listings; `q` matches title and description; `location` is a pickup code; `pageSize` at most 50. See Search below |
| `GET /listings/{id}`                                               | Public        | `200` with the listing and its photos; a listing that is not `PUBLISHED` only for its owner and administrators, otherwise `404`                                                   |
| `POST /listings`                                                   | Student       | `201` with the listing: `PUBLISHED`, `PENDING_REVIEW`, or DRAFT with `publishError`                                                                                               |
| `POST /listings/{id}/publish`                                      | Owner         | `200` with the listing; `403` for anyone else                                                                                                                                     |
| `POST /listings/{id}/unpublish`                                    | Owner         | `200` with the `UNPUBLISHED` listing, also on a repeat; `409` from any status other than `PUBLISHED`                                                                              |
| `GET /admin/listings?status=&page=&pageSize=`                      | Administrator | `200` with the listings in that status (`PENDING_REVIEW` by default), oldest first, with their flags                                                                              |
| `POST /admin/listings/{id}/approve`                                | Administrator | `200` with the `PUBLISHED` listing; `409` unless `PENDING_REVIEW`                                                                                                                 |
| `POST /admin/listings/{id}/reject` with `{ reason }`               | Administrator | `200` with the `REJECTED` listing; `409` unless `PENDING_REVIEW`                                                                                                                  |
| `GET /internal/listings/{id}/quote?start=&end=`                    | Booking       | `200` with `{ listingId, ownerId, days, rentalFee, deposit, lateFeePerDay }`; `rentalFee` is the daily rate times the days, with no platform fee                                  |

The administrator routes answer `403` to anyone else. The quote answers `400` when `start` or `end` is not midnight in Bangkok, the period is shorter than one day, or it is longer than the listing's maximum rental days; `404` for an unknown listing; and `409` for a listing that is not published. Whether the dates are free is Booking's check.

## Booking rules and calls to Payment and Rental

Booking implements the request and approval steps of the booking sequence above in `apps/booking`. Payment and Rental implement the calls below, as described under Payment rules and Rental rules; their owner has confirmed this contract.

### Booking status

| Status        | Meaning                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PENDING`     | The renter asked; the dates are reserved. The request expires at the earlier of 24 hours after it was made and the start of the period.                                                 |
| `AUTHORIZING` | The owner approved; Booking is authorizing the payments and creating the rental. The dates stay reserved until it is `CONFIRMED` or `FAILED`.                                           |
| `CONFIRMED`   | The fee and deposit are authorized and the rental exists. Rental releases the dates after the return.                                                                                   |
| `DECLINED`    | The owner refused, with an optional reason of at most 500 characters. The dates are released.                                                                                           |
| `EXPIRED`     | The owner did not answer in time. The dates are released.                                                                                                                               |
| `CANCELLED`   | The renter or the owner cancelled a `PENDING` or `CONFIRMED` booking before pickup. The dates are released and Payment voids any holds. No fee is charged.                              |
| `FAILED`      | Payment or Rental refused the approval, or the period started while it was still `AUTHORIZING`. The dates are released and Payment voids the holds; the reason is kept in `last_error`. |

- A request needs whole Bangkok days that start after now and end within 366 days, an eligible renter (Identity), a published listing (Listing quote), and a renter who is not the owner. A renter holds at most five `PENDING` or `AUTHORIZING` requests at once.
- A stale `PENDING` booking becomes `EXPIRED` and frees its dates when the sweeper finds it or when a request, approval, decline, cancel, get or list touches it first. Both paths use the same update, so `booking.expired` is written once.
- Only the renter and the owner can read a booking; anyone else gets `NOT_FOUND`. Only the owner approves or declines.
- `booking.requested` goes to the owner, `booking.declined` to the renter, and `booking.confirmed`, `booking.failed`, `booking.expired` and `booking.cancelled` to both. Booking writes them to its own outbox table in the same transaction and the shared relay in `libs/messaging` publishes them (see `docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md`); the data shape is in `libs/contracts/src/events.ts`.

### Approval calls

When the owner approves, Booking makes these calls in order. Each carries the `x-correlation-id` header and counts as failed after 5 seconds. A zero amount is not authorized.

| Order | Call                                           | Body                                                                                                                | Success reply                                       | Repeating it                                                                         |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1     | `POST /internal/payments/authorize` on Payment | `{ operationId, bookingId, payerId, payeeId, kind: "FEE", amount }`                                                 | 2xx `{ id, status }`                                | Same `operationId`, `booking:<booking id>:authorize-fee`, so Payment authorizes once |
| 2     | `POST /internal/payments/authorize` on Payment | Same, with `kind: "DEPOSIT"`                                                                                        | 2xx `{ id, status }`                                | `operationId` is `booking:<booking id>:authorize-deposit`                            |
| 3     | `POST /internal/rentals` on Rental             | `{ bookingId, listingId, ownerId, renterId, period: { start, end }, terms: { rentalFee, deposit, lateFeePerDay } }` | 2xx `{ id, bookingId, status }`; Booking reads `id` | Rental keeps one rental per `bookingId` and returns it again                         |

`payerId` is the renter and `payeeId` the owner; amounts are integer satang, and times are ISO-8601 UTC. A refusal is a 4xx with the shared error body `{ error: { code, message } }`.

A 4xx other than 404 counts as a refusal, while 404, 501, 5xx, a timeout or no connection counts as unavailable. When all three calls succeed, the booking becomes `CONFIRMED` and stores the rental ID.

- **Unavailable:** the booking stays `AUTHORIZING` with the reason stored, and the approval answers successfully with that status. The owner approves again to retry the same calls with the same operation IDs, until the period starts.
- **Refused, or the period has started:** the booking becomes `FAILED` in one transaction that releases the dates and writes `booking.failed`, and the approval answers with that status. Booking then calls `POST /internal/payments/void` on Payment with `{ operationId: "booking:<booking id>:void", bookingId }`, which releases every open hold once.
- **Sweeper:** every minute Booking expires stale `PENDING` bookings, fails the `AUTHORIZING` bookings whose period has started, and calls void again for `FAILED` bookings, and `CANCELLED` bookings with a rental, whose void has not succeeded (`holds_voided_at` is empty). Each step takes at most 50 rows with `FOR UPDATE SKIP LOCKED`.

A hold that an approval still in flight authorizes after the void has run is not voided; it lapses when Payment's authorization expires.

### Cancellation

`CancelBooking` (`POST /api/booking/bookings/{id}/cancel` with an optional `{ reason }` of at most 200 characters) is open to the renter and the owner; anyone else gets `PERMISSION_DENIED` and an unknown ID `NOT_FOUND`.

- One transaction makes a `PENDING` or `CONFIRMED` booking `CANCELLED`, releases the dates and writes `booking.cancelled` with the reason.
- `CONFIRMED` first calls `POST /internal/rentals/by-booking/{bookingId}/cancel` on Rental. A `404` (no rental) is fine; a `409` (picked up, or a pickup in progress) answers `FAILED_PRECONDITION`; Rental unavailable answers `UNAVAILABLE`. After the commit Booking voids the holds, and the sweeper retries a failed void.
- A `CANCELLED` booking is returned unchanged. A stale `PENDING` booking is expired instead and answers `FAILED_PRECONDITION`, as does any other status.

## Payment rules

Payment keeps a demo ledger in `apps/payment`, with no real money and no provider calls (see `docs/adr/adr-006-isolate-payment-integration-behind-adapter.md`). Amounts are integer satang and times are ISO-8601 UTC. A booking has at most one fee (`FEE`) and one deposit (`DEPOSIT`) authorization, and both have the same payer (the renter) and payee (the owner).

### Authorization status

| Status       | Meaning                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `AUTHORIZED` | The amount is held. It can be captured (fee) or settled (deposit) until it expires.                                            |
| `EXPIRED`    | Reported, not stored: an `AUTHORIZED` hold whose `expiresAt` has passed. Capture and settle refuse it; void still releases it. |
| `CAPTURED`   | The fee was taken at pickup.                                                                                                   |
| `SETTLED`    | The deposit was split at the return: the late fee taken and the rest released.                                                 |
| `VOIDED`     | The hold was released in full without being used.                                                                              |

An authorization expires `PAYMENT_AUTHORIZATION_TTL_DAYS` days after it is made: a whole number from 1 to 3650, or 30 when the variable is unset or invalid.

### Idempotency

Every internal call carries an `operationId` of 1 to 200 characters that the caller keeps stable across retries. Payment runs each call in one transaction: it takes an advisory lock on the `operationId`, so a concurrent duplicate waits, and then looks for a ledger entry with that ID.

- No entry: Payment locks the booking's authorizations, applies the change, and stores the entry with a SHA-256 hash of the request body (keys in sorted order) and the reply.
- An entry with the same hash: Payment returns the stored reply and changes nothing.
- An entry with a different hash, or for another operation: `409` with `operationId was already used for a different request`.

A refusal stores nothing, so a corrected retry with the same `operationId` can still succeed.

### Internal endpoints

The gateway refuses `/internal/` paths from outside. Every internal route requires an `x-service-token` header: a short-lived HS256 service JWT (`sub` the calling service, `aud` `campuskit-internal`, five-minute expiry, signed with `INTERNAL_JWT_SECRET`) from a caller on the route's allowlist; a missing or invalid token answers `401` and a service not on the list `403` (see `docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md`). A body that fails validation answers `400`; a refusal of the rules answers `409`, both with the shared error body `{ error: { code, message } }`.

| Call                                                     | Body                                                                                                                      | Reply                                                                       | Rules                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /internal/payments/authorize` (Booking)            | `{ operationId, bookingId, payerId, payeeId, kind, amount }`, `kind` is `FEE` or `DEPOSIT`, `amount` from 1 to 2147483647 | `201` `{ id, status }`                                                      | A payer who is also the payee answers `400`. A second hold of the same kind under a new `operationId`, or a hold whose payer or payee differs from the booking's other hold, answers `409`. Booking skips a zero amount, so a booking may have only one kind or none.                                 |
| `POST /internal/payments/capture` (Rental, at pickup)    | `{ operationId, bookingId, amount }`, `amount` 0 or more                                                                  | `200` `{ bookingId, kind: "FEE", capturedAmount, status }`                  | `amount` must equal the `AUTHORIZED`, unexpired fee, which becomes `CAPTURED`. With no fee authorization, an `amount` of 0 succeeds with `status` `NOT_REQUIRED` and `capturedAmount` 0. A missing, mismatched, expired, captured, settled or voided fee answers `409`. The deposit stays authorized. |
| `POST /internal/payments/void` (Booking)                 | `{ operationId, bookingId }`                                                                                              | `200` `{ bookingId, voided }`, the kinds released by this call, `FEE` first | Every `AUTHORIZED` hold, expired or not, becomes `VOIDED` with its whole amount released. `CAPTURED` and `SETTLED` holds stay as they are; refunds are out of scope.                                                                                                                                  |
| `POST /internal/payments/settle` (Rental, at the return) | `{ operationId, bookingId, deposit, lateFee }`, both 0 or more                                                            | `200` `{ bookingId, lateFeeCharged, depositReleased, payout }`              | See Settlement below.                                                                                                                                                                                                                                                                                 |

### Settlement

1. A booking is settled once: when it already has a payout, settle answers `409` with `The booking is already settled`.
2. The fee, when the booking has one, must be `CAPTURED`; otherwise `409`.
3. When `deposit` is more than 0, the deposit authorization must exist, be `AUTHORIZED` and unexpired, and hold exactly `deposit`; otherwise `409`. When `deposit` is 0, the booking must have no deposit authorization.
4. `lateFeeCharged = min(lateFee, deposit)` and `depositReleased = deposit - lateFeeCharged`. The deposit becomes `SETTLED` with these two amounts. The renter is never charged more than the deposit.
5. `payout` is the captured fee (0 without a fee) plus `lateFeeCharged`. Payment records one payout to the payee per booking. A booking with no authorization at all settles with every amount 0 and records no payout.

For example, a fee of 6000, a deposit of 30000 and a late fee of 8000 give `lateFeeCharged` 8000, `depositReleased` 22000 and `payout` 14000.

### Payment status

`GET /api/payment/payments/bookings/{bookingId}` (needs a token; the service serves it at `/payments/bookings/{bookingId}`) answers `200` with `{ bookingId, authorizations, payout }`:

- `authorizations` lists the holds, `FEE` before `DEPOSIT`, each as `{ id, kind, amount, capturedAmount, releasedAmount, status, expiresAt }`, where `status` is `EXPIRED` for an `AUTHORIZED` hold past its time.
- `payout` is `{ amount, payeeId, paidAt }` after settlement, otherwise `null`.

Only the payer and the payee can read a booking's payments; anyone else gets `404`. A booking with nothing authorized answers an empty list and a `null` payout to any caller, because Payment cannot tell who takes part in it.

## Rental rules

Rental runs the handover in `apps/rental`. Booking opens one rental per confirmed booking (see Approval calls above); the rental keeps the booking's listing, people, period and terms. Amounts are integer satang and times are ISO-8601 UTC. Rental writes `rental.started`, `rental.closed`, `rental.reminded` and `rental.overdue` through the shared outbox (see Notification rules below).

### Rental status

| Status               | Meaning                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWAITING_PICKUP`    | Booking opened the rental. The owner holds the pickup code and gives it to the renter at the handover.                                                                                |
| `ACTIVE`             | The renter confirmed pickup with the owner's code and Payment captured the fee; the deposit stays authorized. The renter holds the return code.                                       |
| `SETTLEMENT_PENDING` | The owner accepted the return with the renter's code. The return time and the late fee are fixed. Rental is releasing the dates and settling, or a step failed and waits for a retry. |
| `CLOSED`             | Booking released the dates and Payment settled the deposit, late fee and payout. Review accepts reviews of a closed rental.                                                           |
| `CANCELLED`          | Booking cancelled the booking before pickup. Reached only from `AWAITING_PICKUP`, with no event; Booking announces the cancellation.                                                  |

Overdue is a flag, not a status: an `ACTIVE` rental whose period has ended carries `overdueAt` (see Reminders and overdue below).

### Codes

- Both codes are six digits drawn from a cryptographic random source when the rental opens. They are stored as they are, because their holder must read them, and compared in constant time.
- `pickupCode` is shown only to the owner, and only while `AWAITING_PICKUP`; `returnCode` only to the renter, and only while `ACTIVE`. Otherwise the field is an empty string.
- Each code has its own counter of wrong attempts. A wrong code answers `400` with `Wrong pickup code` or `Wrong return code`, and the attempt is committed before the answer. The fifth wrong attempt in a row replaces the code with a new one and restarts the counter, so the holder reads the new code from the rental page. A successful step resets its counter.

### Pickup

`POST /api/rental/rentals/{id}/pickup` with `{ code }`, by the renter:

1. Rental locks the rental and checks, in this order: the caller is the renter (anyone who does not take part gets `404`, the owner gets `403`); the status is `AWAITING_PICKUP` (otherwise `409` with `The item was already picked up`); the time is from 24 hours before the period starts until the period ends (otherwise `409`); the code (see Codes above).
2. Rental calls `GetBooking` over gRPC with the renter's token. The booking must be `CONFIRMED` (otherwise `409` with `The booking is not confirmed`) and have the same listing, renter, owner and period as the rental (otherwise `409` with `The booking does not match the rental`).
3. Rental calls `POST /internal/payments/capture` with `{ operationId: "rental:<rental id>:capture-fee", bookingId, amount }`, where `amount` is the rental fee.
4. A conditional update makes the rental `ACTIVE` with `pickedUpAt`, and the answer is `200` with the rental.

Steps 2 and 3 run outside the database transaction. When either fails, the rental stays `AWAITING_PICKUP`, the code stays valid and `lastError` keeps the reason, for example `Fee capture was declined: <Payment message>`. The answer is `409` when Booking or Payment refused (a 4xx other than 404, or the gRPC codes `NOT_FOUND`, `PERMISSION_DENIED`, `FAILED_PRECONDITION` and `INVALID_ARGUMENT`) and `503` when the service is unavailable (404, 501, 5xx, any other gRPC code, or no answer within 5 seconds). The renter enters the code again to retry; the capture keeps its operation ID, so the fee is taken once.

Before step 2, the pickup claims the rental by setting `pickup_claimed_at`, a two-minute lease, so a cancellation cannot end the rental while the fee is captured; a failed step clears the claim. When two pickups race, one holds the claim and the others answer `409`; a pickup that starts after the rental is `ACTIVE` answers `409`.

### Return and settlement

`POST /api/rental/rentals/{id}/return` with `{ code }`, by the owner:

1. Rental locks the rental. The caller must be the owner (anyone who does not take part gets `404`, the renter gets `403`). `AWAITING_PICKUP` answers `409` with `The item has not been picked up yet`, and `CLOSED` answers `409` with `The rental is already closed`.
2. While `ACTIVE`, the code is required (`400` with `The return code is required`, which counts no attempt). With the right code, Rental computes the late days and late fee at this moment and a conditional update makes the rental `SETTLEMENT_PENDING` with `returnedAt`, `lateDays` and `lateFee`.
3. While `SETTLEMENT_PENDING`, the code is ignored and the stored return time and late fee are kept; they are never computed again.
4. Rental calls `ReleaseCalendar` over gRPC with the owner's token, then `POST /internal/payments/settle` with `{ operationId: "rental:<rental id>:settle", bookingId, deposit, lateFee }`, where `lateFee` is the stored one.
5. When both succeed, a conditional update makes the rental `CLOSED` with `closedAt` and clears `lastError`. When either fails, the rental stays `SETTLEMENT_PENDING` with `lastError` set to `<Step> was declined: <message>` or `<Step> is unavailable: <message>`, where the step is `Calendar release` or `Settlement`, and the answer is still `200` with that rental.

The owner retries a failed settlement by calling return again, without a code. `ReleaseCalendar` changes nothing the second time and the settle operation ID is stable, so nothing is released or charged twice. When two returns race, only one update to `CLOSED` applies and both answer the closed rental; a return that starts after the rental is `CLOSED` answers `409`.

Late fee: `lateDays` is `ceil((returnedAt - period.end) / 24 hours)` when the item comes back after the period ends, and 0 otherwise; there is no grace time. `lateFee` is `lateDays` times `lateFeePerDay`, at most 2147483647. Payment takes at most the deposit (see Settlement above).

### Reminders and overdue

A sweeper runs every `RENTAL_SWEEP_INTERVAL_MS` (one minute by default), takes at most 50 `ACTIVE` rentals per step with `FOR UPDATE SKIP LOCKED`, and runs each sweep under a new correlation ID. Conditional updates on `reminder_sent_at` and `overdue_at` make each event happen once across replicas.

- **Reminder:** when the period ends within `RENTAL_REMINDER_LEAD_MS` (24 hours by default), Rental sets `reminder_sent_at` and writes `rental.reminded` to the renter.
- **Overdue:** once the period has ended, Rental sets `overdue_at` and writes `rental.overdue` to the owner and the renter. A rental already past its end is never reminded.

The return flow does not change; the late fee is still fixed at the return.

### Condition evidence

- Each party records the item once per stage in `rental_evidence`: `stage` (`PICKUP` or `RETURN`), `condition` (the listing codes `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`), up to 20 `accessories` of 1 to 60 characters, up to 3 photos as JPEG, PNG or WebP data URLs of at most 400 KB each, and an optional note of at most 500 characters. A unique key on rental, stage and recorder makes a second record answer `409`; records are never edited.
- `PICKUP` is open while the rental is `AWAITING_PICKUP`, `RETURN` while it is `ACTIVE` (overdue included); otherwise `409`. Anyone but the two parties gets `404`.
- The codes do not require evidence, so a demo can skip it. Evidence raises no event and drives no damage deduction. Rental accepts JSON bodies up to 2 MB, and the web container's nginx up to 4 MB.

### Rental endpoints

Every public route needs a token; the service serves them at `/rentals`. The gateway refuses the internal routes from outside. A body or ID that fails validation answers `400`.

| Route                                                                                            | Caller                                          | Answer                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/rental/rentals?role=` (`role` is `renter` or `owner`)                                  | Anyone with a token                             | `200` with `{ rentals }`, the caller's rentals as renter or as owner, newest first, at most 100                                                                                                                                         |
| `GET /api/rental/rentals/{id}`                                                                   | The renter or the owner; anyone else gets `404` | `200` with the rental                                                                                                                                                                                                                   |
| `POST /api/rental/rentals/{id}/pickup` with `{ code }`                                           | The renter                                      | `200` with the `ACTIVE` rental                                                                                                                                                                                                          |
| `POST /api/rental/rentals/{id}/return` with an optional `{ code }`                               | The owner                                       | `200` with the `CLOSED` rental, or the `SETTLEMENT_PENDING` rental with `lastError`                                                                                                                                                     |
| `POST /api/rental/rentals/{id}/evidence` with `{ stage, condition, accessories, photos, note? }` | The renter or the owner                         | `201` with the record; see Condition evidence below                                                                                                                                                                                     |
| `GET /api/rental/rentals/{id}/evidence`                                                          | The renter or the owner                         | `200` with `{ evidence }`, both parties' records, pickup first, photos included, in any status                                                                                                                                          |
| `POST /internal/rentals` with the body of the approval call above                                | Booking                                         | `201` with `{ id, bookingId, status }`. The same `bookingId` returns the same rental; other people, period or terms for it answer `409`. An owner who is also the renter, or a period that does not end after it starts, answers `400`. |
| `GET /internal/rentals/{id}`                                                                     | Review                                          | `200` with `{ id, bookingId, listingId, ownerId, renterId, status, closedAt }`, without codes; `404` when unknown                                                                                                                       |
| `POST /internal/rentals/by-booking/{bookingId}/cancel`                                           | Booking                                         | `200` with the `CANCELLED` rental, also on a repeat; `404` when the booking has no rental; `409` once picked up or while a pickup claim is fresh                                                                                        |

A rental in a response has `id`, `bookingId`, `listingId`, `ownerId`, `renterId`, `status`, `period` `{ start, end }`, `terms` `{ rentalFee, deposit, lateFeePerDay }`, `pickupCode`, `returnCode`, `pickedUpAt`, `returnedAt`, `closedAt`, `lateDays`, `lateFee`, `overdue`, `overdueAt`, `lateFeeSoFar`, `lastError`, `createdAt` and `updatedAt`. Every field is present, with an empty string or zero when it is not set. `overdue` is true while the rental is `ACTIVE` and flagged; `lateFeeSoFar` is the late fee if the item came back now, computed as at the return, and 0 unless overdue.

`apps/rental/e2e/rental-flow.mjs` runs the whole flow through the gateway of a running stack, from a new listing to the payout.

## Review rules and endpoints

Review stores reviews in the MongoDB collection `reviews` in `apps/review`, one per (`rentalId`, `reviewerId`). A participant reviews the other participant of a `CLOSED` rental once, with a rating from 1 to 5 and an optional comment of at most 500 characters. Review asks Rental (`GET /internal/rentals/{id}`) for the status and the participants before it stores a review. Review publishes no events.

| Route                                                 | Caller              | Answer                                                                                                                                          |
| ----------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /reviews` with `{ rentalId, rating, comment? }` | A participant       | `201` with the review; `404` unknown rental; `403` not a participant; `409` not `CLOSED` or already reviewed; `503` when Rental is unavailable  |
| `GET /reviews?userId=&page=&pageSize=`                | Anyone with a token | `200` with `{ items, total, averageRating, page, pageSize }`, the reviews the user received, newest first; `pageSize` 20 by default, at most 50 |
| `GET /reviews/rentals/{rentalId}`                     | Anyone with a token | `200` with `{ items }`, the reviews the caller wrote and received for that rental                                                               |
| `GET /internal/users/{id}/reputation`                 | Listing             | `200` with `{ userId, averageRating, reviewCount }`                                                                                             |
| `GET /internal/reputation?userIds=` (1 to 50 IDs)     | Listing             | `200` with `{ items }`, one summary per distinct ID in the order asked                                                                          |

`averageRating` is rounded half up to one decimal place, and `null` when the user has no reviews.

## Notification rules and endpoints

Events follow `docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md`; the envelope and data shapes are in `libs/contracts/src/events.ts`.

### Outbox and relay

`libs/messaging` holds the shared outbox. A producer calls `writeOutbox` inside the transaction that changes its state, so the row in its own `outbox_events` table exists exactly when the change commits; the row ID is the event ID. `OutboxModule` runs a relay in each producer that polls every second, takes up to 50 unsent rows oldest first with `FOR UPDATE SKIP LOCKED`, publishes each as a persistent message to the topic exchange `campuskit.events` (routing key = event type), and sets `sent_at` only after the broker confirms. It stops at the first failed publish and tries again on the next poll, so a broker outage only delays events. The publisher reconnects after 1 second, doubling to at most 30, and logs one warning per outage and one line on recovery; events wait in the outbox meanwhile.

### Events

| Event               | Producer | Recipients       | When                                                       |
| ------------------- | -------- | ---------------- | ---------------------------------------------------------- |
| `identity.verified` | Identity | Student          | An administrator approves the student status               |
| `listing.published` | Listing  | Owner            | The listing becomes `PUBLISHED`, at once or on approval    |
| `listing.rejected`  | Listing  | Owner            | An administrator rejects the listing; carries the reason   |
| `booking.requested` | Booking  | Owner            | A renter requests dates                                    |
| `booking.declined`  | Booking  | Renter           | The owner declines                                         |
| `booking.confirmed` | Booking  | Owner and renter | The approval completes                                     |
| `booking.failed`    | Booking  | Owner and renter | An approval cannot complete                                |
| `booking.expired`   | Booking  | Owner and renter | The owner did not answer in time                           |
| `booking.cancelled` | Booking  | Owner and renter | A participant cancels before pickup; carries the reason    |
| `rental.started`    | Rental   | Owner and renter | The pickup makes the rental `ACTIVE`                       |
| `rental.reminded`   | Rental   | Renter           | The period ends within the reminder lead time              |
| `rental.overdue`    | Rental   | Owner and renter | The period ended before the return                         |
| `rental.closed`     | Rental   | Owner and renter | Settlement makes the rental `CLOSED`; carries the late fee |

### Consumer

Notification consumes the durable queue `notification.inbox`, bound to every event. A body that is not JSON or not a valid envelope goes to the dead-letter queue `notification.inbox.dead`. Notification also consumes that queue into the MongoDB collection `dead_letters`, deduplicated on a SHA-256 of the body and its dead-letter time, with the body cut to 64 KiB; it acknowledges after the write and requeues if MongoDB fails. Dead letters are not replayed, because only invalid envelopes reach them. A valid event is stored as one inbox entry per recipient with an upsert on (`eventId`, `recipient`), so a redelivery changes nothing; the message is acknowledged after the write and requeued if MongoDB fails. When the broker is down at startup or the connection drops, the consumer reconnects in the background after 1, 2, 4, ... seconds, at most 30.

### Inbox endpoints

Every route needs a token and works only on the caller's own entries; the service serves them at `/inbox`.

| Route                                         | Answer                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/notification/inbox`                 | `200` with `{ entries, unread }`: the newest 50 entries by event time, and the count of all unread entries |
| `GET /api/notification/inbox/unread-count`    | `200` with `{ unread }`                                                                                    |
| `POST /api/notification/inbox/{eventId}/read` | `200` with the entry; repeating it keeps the first `readAt`; `404` when the caller has no such entry       |
| `POST /api/notification/inbox/read-all`       | `200` with `{ unread: 0 }`                                                                                 |

An entry has `eventId`, `type`, `occurredAt`, `data` (the event data), `read`, and `readAt` (an empty string while unread). The web app turns the type and data into the text it shows and polls the unread count every 30 seconds for the badge in the navigation.

`GET /api/notification/admin/dead-letters?page=&pageSize=` lists the stored dead letters to administrators (`401` without a token, `403` for anyone else). Each item has `id`, `routingKey`, `eventId`, `type`, `correlationId`, `reason`, `queue`, `count`, `deadLetteredAt`, `receivedAt`, `content`, and `size`.

### Correlation IDs in logs

Every service log line carries `[cid=<id>]` while it handles a request, a gRPC call, outbox relay work, or an event. `libs/common` keeps the ID in an AsyncLocalStorage context, set by a global interceptor and read by the shared logger. Booking takes the ID from the gRPC metadata `x-correlation-id`, and the event envelope carries it to Notification.

`apps/notification/e2e/broker-outage.mjs` measures delivery through a broker outage (see `docs/architecture/quality-resilience.md`).

## Gateway rules

The gateway checks every request under `/api`, both the proxied REST services and its own Booking routes, in this order:

1. **Correlation ID.** The gateway keeps the caller's `x-correlation-id` when it is 1 to 128 characters of letters, digits, `.`, `_`, or `-`; otherwise it creates a UUID. It forwards the ID to the service and returns it in the response.
2. **Internal paths.** Any path with an `internal` segment, in any case or percent-encoding, answers `404` and is never forwarded.
3. **Identity headers.** Client headers that start with `x-user-`, `x-auth-`, or `x-role`, and `x-forwarded-user`, are removed. Services take the caller's identity only from the JWT.
4. **Token.** Only these routes are public: `POST /api/identity/accounts` (register), `POST /api/identity/auth/login`, `GET /api/listing/listings` (search) and `GET /api/listing/listings/{id}` (detail, lowercase UUID only), so guests can browse before they register, and `GET /api/<service>/health` for the proxied REST services (Booking has no route here; its health is on `booking:3007` inside the network). Public routes ignore the `Authorization` header but still forward it; listing detail uses a valid token to show an unpublished listing to its owner or an administrator. Every other route needs `Authorization: Bearer <JWT>`, signed with HS256 and carrying a UUID `sub`, a `role` of `student` or `admin`, and an `exp`. A missing token answers `401` with `Missing bearer token`; a wrong, expired, or forged token answers `401` with `Invalid token`.

When a service is down or does not answer within 15 seconds, the gateway answers `502` with `The <service> service is unavailable`.

The gateway forwards the `Authorization` header unchanged, and each service still checks the token and authorises the request (see `docs/adr/adr-002-authenticate-centrally-authorise-at-data-owner.md`).

The gateway serves the Booking routes itself and calls Booking over gRPC (`libs/contracts/proto/booking.proto`). Every Booking route needs a token. On each call the gateway sends the caller's `Authorization` header and the correlation ID as the gRPC metadata `authorization` and `x-correlation-id`; Booking reads the caller from the token. `SetupCalendar` and `ReleaseCalendar` have no REST route; Listing and Rental call them over gRPC. `SetupCalendar` and `FilterAvailable` also require Listing's service token, and `ReleaseCalendar` Rental's, as the `x-service-token` metadata; a missing or invalid one answers `UNAUTHENTICATED` and another service's `PERMISSION_DENIED`. The methods the gateway calls rely on the user token alone.

| Route                                                                                             | Booking method      | Answer                                  |
| ------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------- |
| `POST /api/booking/bookings` with `{ listingId, period: { start, end } }`                         | `RequestBooking`    | `201` with the booking                  |
| `GET /api/booking/bookings?role=&status=` (`role` is `renter` or `owner`; `status` is optional)   | `ListBookings`      | `200` with `{ bookings }`, newest first |
| `GET /api/booking/bookings/{id}`                                                                  | `GetBooking`        | `200` with the booking                  |
| `POST /api/booking/bookings/{id}/approve`                                                         | `ApproveBooking`    | `200` with the booking                  |
| `POST /api/booking/bookings/{id}/decline` with an optional `{ reason }` of at most 500 characters | `DeclineBooking`    | `200` with the booking                  |
| `POST /api/booking/bookings/{id}/cancel` with an optional `{ reason }` of at most 200 characters  | `CancelBooking`     | `200` with the booking                  |
| `GET /api/booking/listings/{listingId}/availability?start=&end=`                                  | `CheckAvailability` | `200` with `{ available }`              |

A booking in a response has `id`, `listingId`, `renterId`, `ownerId`, `status`, `period` `{ start, end }`, `terms` `{ rentalFee, deposit, lateFeePerDay }` in satang, `declineReason` (empty unless `DECLINED`), `expiresAt`, `createdAt`, and `updatedAt`; every field is present, with an empty string or zero when Booking left it unset.

The gateway validates IDs as UUIDs and times as ISO-8601 before it calls Booking, and answers `400` otherwise; Booking checks the rules. Booking's gRPC status codes become HTTP statuses as `apps/gateway/src/booking/grpc-error.ts` lists them. When Booking does not answer within 25 seconds (an approval can make four 5-second calls), or reports `DEADLINE_EXCEEDED`, the gateway answers `504` with `The booking service did not answer in time`.

## Service discovery and local deployment

Docker Compose DNS resolves service names inside the Compose network. Services read endpoint addresses from environment configuration instead of hard-coding container IPs. The gateway translates client REST requests to Booking gRPC where needed; Listing and Rental also call Booking through gRPC.

| Service               | Address             | Protocol                                               | Code                |
| --------------------- | ------------------- | ------------------------------------------------------ | ------------------- |
| API Gateway           | `gateway:3000`      | REST (public)                                          | `apps/gateway`      |
| Student Identity      | `identity:3001`     | REST                                                   | `apps/identity`     |
| Listing               | `listing:3002`      | REST                                                   | `apps/listing`      |
| Booking               | `booking:50051`     | gRPC (HTTP `booking:3007` serves only health and docs) | `apps/booking`      |
| Rental                | `rental:3003`       | REST                                                   | `apps/rental`       |
| Payment               | `payment:3004`      | REST                                                   | `apps/payment`      |
| Review and Reputation | `review:3005`       | REST                                                   | `apps/review`       |
| Notification          | `notification:3006` | REST inbox; RabbitMQ consumer                          | `apps/notification` |

The local deployment uses one PostgreSQL instance and one MongoDB instance with separate logical databases and credentials per service, plus persistent volumes. There is no external service registry and no multi-instance gRPC balancing. Volumes alone do not prove backup and restore targets; RPO/RTO, TLS, and load and usability testing remain acceptance or production targets (see `docs/requirements.md`).

## Collaboration checks

These are a validation plan, not claimed test results.

- Listing publication: validate before saving a DRAFT; calendar setup must succeed before publication.
- Booking: prevent overlapping committed reservations; retry authorization within its window and compensate for a failed confirmation.
- Handover and settlement: keep the deposit after fee capture; accept evidence and code at return, release the calendar, settle, then close.
- Review requires a CLOSED rental and participant authorization.
- Verify broker outage and recovery and duplicate event delivery separately from payment-workflow recovery (measured in `docs/architecture/quality-resilience.md`).

## Open questions

None at the moment. Internal service authentication is settled in `docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md`.
