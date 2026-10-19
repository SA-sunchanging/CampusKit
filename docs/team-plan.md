# Team Plan

How the five members split the work from now until the final presentation. Each member owns whole
services, from database to web page, so that members rarely edit the same files. Every member has
**Core**, **Should**, and **Other** work in about the same amount.

- **Core:** needed for the minimum requirements (full marks). Finish first.
- **Should:** makes the system more complete and full marks safer. Start after your Core works end to end.
- **Other:** further work. Not planned for this term.

The requirements come from `docs/reference/course-syllabus.md`. The design is in
`docs/architecture/services.md` and `docs/adr/`. How to run the code is in `README.md`.

## Roles

Write each member's name next to a role.

| Role | Member | Owns |
| --- | --- | --- |
| **A: Platform and Identity** | | `apps/identity`, `apps/gateway` (except booking routes), `libs/common`, `infra/`, root config, web shell and account pages |
| **B: Listing** | | `apps/listing`, web listing and admin pages, `loadtest/` |
| **C: Booking** | | `apps/booking`, `apps/gateway/src/booking`, `libs/contracts/proto`, web booking pages |
| **D: Rental and Payment** | | `apps/rental`, `apps/payment`, web rental pages |
| **E: Events and Reviews** | | `apps/notification`, `apps/review`, `libs/messaging`, `libs/contracts/src/events.ts`, web inbox and review pages |

Everyone draws the C4 component view (level 3) of their own services and records their own Git
commits; Git contribution counts toward the progress grade.

### A: Platform and Identity

**Core**
- Identity: register and log in with email and password (hash passwords), issue the JWT, log out on the client.
- Identity: internal eligibility and profile lookup for Listing and Booking (`canPublish`, `canBook`, payout profile).
- Seed script with demo accounts: two verified students and one administrator.
- Web shell: routing, login and register pages, token handling, mobile-width layout.
- Gateway: keep routing and JWT checks working as services grow.
- Slides: service discovery (Compose DNS and environment configuration), C4 context and container views.

**Should**
- Email verification code (shown on the UI in demo mode) and administrator review of student status, with a page for the admin.
- Identity writes `identity.verified` events through the outbox.
- Internal service authentication between services (still an open question in `docs/architecture/services.md`).
- GitHub Actions that run typecheck, lint, test, and build on each pull request.

**Other**
- University identity provider, account restriction and erasure, TLS between services.

### B: Listing

**Core**
- Create a listing: validate, save a DRAFT, check eligibility with Identity, set up the calendar with Booking (gRPC), then publish.
- Search by keyword and category; listing detail; internal quote endpoint for Booking (fee, deposit, late-fee rule, owner).
- Photos as compressed inline data URLs.
- Web: search, listing detail, and create-listing pages.
- Load test with k6, two types (for example load and stress) on search and detail, with 1,500 seeded listings; explain the results.

**Should**
- Moderation: flagged or high-value listings wait for administrator approval; admin moderation page; `listing.published` and `listing.rejected` events.
- Filter by dates and campus location; owner reputation in search results (from Review).
- Unpublish a listing.
- Second quality attribute: scalability, by running more Listing replicas and comparing k6 results.

**Other**
- Editing and resubmitting a rejected listing, object storage for photos, full-text search.

### C: Booking

**Core**
- Finish `libs/contracts/proto/booking.proto` first: calendar setup, availability, request, approve, decline, get, list, and release calendar.
- Calendar with the PostgreSQL exclusion constraint (raw SQL migration; `btree_gist` is already installed).
- Request a booking (eligibility from Identity, quote from Listing, atomic reservation), owner approves or declines.
- On approval: authorize with Payment, create the rental with Rental, mark CONFIRMED, write `booking.*` events.
- Gateway REST routes for booking in `apps/gateway/src/booking`.
- Web: request form on the listing page, my bookings, owner approve or decline.
- Slides: sequence diagrams; assemble the final slide deck and the live-demo script.

**Should**
- Expiry worker for requests the owner does not answer; cancellation before pickup.
- Compensation: void authorizations and release dates when confirmation fails; authorization retry window.
- Concurrency test: many overlapping requests at once, exactly one succeeds.

**Other**
- Calendar reconciliation, rescheduling bookings affected by a late return.

### D: Rental and Payment

**Core**
- Payment: demo ledger with fee and deposit authorization, capture, void, and settlement (late fee, deposit release, payout); every operation carries a unique operation ID so a retry never repeats it.
- Payment: payment status per booking for the web.
- Rental: create the rental (idempotent per booking), issue pickup and return codes.
- Rental: confirm pickup (recheck the booking over gRPC, capture the fee, ACTIVE); confirm return (SETTLEMENT_PENDING, release the calendar, settle, CLOSED); internal rental lookup for Review.
- Web: rental page showing codes, code entry, status, and payment status.
- Slides: risk matrix with at least three risks.

**Should**
- Condition evidence (photos, condition, accessories) at pickup and return.
- Overdue job, late-fee calculation, and return-reminder events.
- Settlement retry endpoint and a test that a duplicate capture is not charged twice.

**Other**
- Real payment provider sandbox, provider reconciliation, deposit-expiry alerts, dispute handling.

### E: Events and Reviews

**Core**
- Outbox in `libs/messaging`: an outbox table that producers write in the same transaction, and a relay that publishes with confirmation and marks entries sent. Help Identity, Listing, Booking, and Rental plug it in.
- Notification: store each event once per recipient in the MongoDB inbox; list the caller's inbox; mark as read.
- Event names and payloads agreed with every producer in `libs/contracts/src/events.ts`.
- Web: inbox page with an unread count.
- Quality attribute: resilience. Stop RabbitMQ during bookings and measure that no booking fails and every event arrives after recovery.

**Should**
- Reviews: submit after a CLOSED rental (participants only, one review each), reputation summary for Listing; web review form.
- Automatic reconnect to RabbitMQ (`amqplib` has a recovery option); a way to inspect dead-lettered events.
- Correlation IDs in every log line, across services and events.

**Other**
- External email and push delivery, broker high availability, a metrics and tracing stack.

## Interfaces between members

Agree these first. Until the real code exists, the owner keeps a stub that answers `501`, so callers can
wire their code. Names below are proposals; the owner finalizes them by the contract freeze.

| Caller → owner | Interface | Kind |
| --- | --- | --- |
| Listing, Booking → Identity | `GET /internal/users/{id}/eligibility` | REST |
| Listing → Booking | `SetupCalendar` | gRPC |
| Listing → Review | `GET /internal/users/{id}/reputation` | REST |
| Booking → Listing | `GET /internal/listings/{id}/quote?start=&end=` | REST |
| Booking → Payment | `POST /internal/payments/authorize`, `POST /internal/payments/void` | REST |
| Booking → Rental | `POST /internal/rentals` | REST |
| Rental → Booking | `GetBooking`, `ReleaseCalendar` | gRPC |
| Rental → Payment | `POST /internal/payments/capture`, `POST /internal/payments/settle` | REST |
| Review → Rental | `GET /internal/rentals/{id}` (status and participants) | REST |
| Gateway → Booking | REST under `/api/booking` translated to gRPC | gRPC |
| Identity, Listing, Booking, Rental → Notification | events through the outbox and RabbitMQ | RabbitMQ |

Services find each other through environment variables such as `BOOKING_GRPC_URL` and `PAYMENT_URL`
(see each `apps/<service>/compose.yaml`), never hard-coded addresses.

### Shared conventions

| Topic | Rule |
| --- | --- |
| Public paths | The web app calls only the gateway: `/api/<service>/<path>`. |
| Internal paths | Service-to-service REST endpoints start with `/internal/`. |
| Auth | `Authorization: Bearer <JWT>`. Claims are only `sub` (user ID) and `role` (`student` or `admin`). Ask Identity for anything else. |
| Authorisation | The service that owns the data checks ownership and participation. |
| Tracing | Forward the `x-correlation-id` header on every call and put it in every event. |
| Errors | `{ "error": { "code", "message" } }` (already done by `libs/common`). |
| Data | IDs are UUIDs, money is integer satang (THB), times are ISO-8601 UTC, date ranges are half-open `[start, end)`. |
| Money calls | Every Payment request carries an `operationId`; repeating it returns the first result. |
| Events | The envelope in `libs/contracts/src/events.ts`; names are `<service>.<past-tense>`, for example `booking.confirmed`. |
| Status values | The owning service defines them, for example Rental: `AWAITING_PICKUP`, `ACTIVE`, `SETTLEMENT_PENDING`, `CLOSED`. |

## Working without conflicts

- Change only the folders your role owns. If you need a change elsewhere, ask the owner or open a pull request for them to review.
- Fill in `.github/CODEOWNERS` with GitHub usernames so the right owner reviews each pull request.
- A change to `booking.proto` or `events.ts` needs review from every service that uses it.
- One branch per task (`feat/listing-search`), small pull requests into `main`.
- Add npm packages in their own small commit; `package.json` is shared.
- Run the checks in `README.md` before opening a pull request.

## Timeline

| Dates | Goal |
| --- | --- |
| 19–21 Oct | Everyone runs the stack. Contract freeze: stub endpoints with Swagger, `booking.proto`, event names. |
| 22–27 Oct | Login, listing publication through gRPC, booking request, one event in the inbox. **Progress 3 video due 27 Oct.** |
| 28 Oct–3 Nov | Every Core item done; the whole rental flow works from listing to closed rental. |
| 4–8 Nov | Should items; load-test runs; risk matrix; quality-attribute measurement; slides. |
| 9 Nov | Code freeze. |
| 10 Nov | Full rehearsal of the 15-minute presentation and live demo. |
| 11 Nov | Final presentation and live demo. |

## Course checklist

| Requirement | Owner |
| --- | --- |
| 3 business use cases and authentication, live front-end demo | everyone (A for authentication) |
| REST service | A, B, D, E |
| gRPC service | C |
| Message-broker service | E |
| API gateway | A (C for booking routes) |
| Service discovery explained | A |
| PostgreSQL and MongoDB | everyone |
| Load test, two types, explained | B |
| Risk matrix, at least three issues | D |
| One measured quality attribute | E |
| C4 levels 1–4 and sequence diagrams | A (levels 1–2), everyone (level 3 for own services, level 4 for one key class), C (sequences) |
| Slide deck and demo script | C |
