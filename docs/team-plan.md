# Team Plan

How the five members split the work from now until the final presentation. Each member owns whole
services, from database to web page, so that members rarely edit the same files. Every member has
**Core**, **Should**, and **Other** work in about the same amount.

- **Core:** needed for the minimum requirements (full marks). Finish first.
- **Should:** makes the system more complete and full marks safer. Start after your Core works end to end.
- **Other:** further work. Not planned for this term.

Core and Should items are checkboxes:

- Tick an item (`- [x]`) only when it is on `main`, passes CI, and works in the running stack,
  with the tests that `AGENTS.md` asks for. Work on a local or side branch is not done.
- To take over another member's item, agree with its owner first, then append `(taken by <role>)`
  to the line, for example `(taken by A)`. Tell the owner when you push, because the code lands
  in their folders.

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
- [x] Identity: register and log in with email and password (hash passwords), issue the JWT, log out on the client.
- [x] Identity: internal eligibility and profile lookup for Listing and Booking (`canPublish`, `canBook`, payout profile).
- [x] Seed script with demo accounts: two verified students and one administrator.
- [x] Web shell: routing, login and register pages, token handling, mobile-width layout.
- [x] Gateway: keep routing and JWT checks working as services grow.
- [ ] Slides: service discovery (Compose DNS and environment configuration), C4 context and container views.

**Should**
- [x] Email verification code (shown on the UI in demo mode) and administrator review of student status, with a page for the admin.
- [x] Identity writes `identity.verified` events through the outbox.
- [x] Internal service authentication between services (`docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md`).
- [x] GitHub Actions that run typecheck, lint, test, and build on each push.
- [x] Shared web theme and UI components in `web/src/ui` (demo style), with sample screens at `/ui-preview`.

**Other**
- University identity provider, account restriction and erasure, TLS between services.

### B: Listing

**Core**
- [x] Create a listing: validate, save a DRAFT, check eligibility with Identity, set up the calendar with Booking (gRPC), then publish.
- [x] Search by keyword and category; listing detail; internal quote endpoint for Booking (fee, deposit, late-fee rule, owner).
- [x] Photos as compressed inline data URLs.
- [x] Web: search, listing detail, and create-listing pages.
- [ ] Load test with k6, two types (for example load and stress) on search and detail, with 1,500 seeded listings; explain the results.

**Should**
- [x] Moderation: flagged or high-value listings wait for administrator approval; admin moderation page; `listing.published` and `listing.rejected` events.
- [x] Filter by dates and campus location; owner reputation in search results (from Review).
- [x] Unpublish a listing.
- [ ] Second quality attribute: scalability, by running more Listing replicas and comparing k6 results.

**Other**
- Editing and resubmitting a rejected listing, object storage for photos, full-text search.

### C: Booking

**Core**
- [x] Finish `libs/contracts/proto/booking.proto` first: calendar setup, availability, request, approve, decline, get, list, and release calendar.
- [x] Calendar with the PostgreSQL exclusion constraint (raw SQL migration; `btree_gist` is already installed). (taken by B)
- [x] Request a booking (eligibility from Identity, quote from Listing, atomic reservation), owner approves or declines.
- [x] On approval: authorize with Payment, create the rental with Rental, mark CONFIRMED, write `booking.*` events.
- [x] Gateway REST routes for booking in `apps/gateway/src/booking`.
- [x] Web: request form on the listing page, my bookings, owner approve or decline.
- [ ] Slides: sequence diagrams; assemble the final slide deck and the live-demo script.

**Should**
- [x] Expiry worker for requests the owner does not answer; cancellation before pickup.
- [x] Compensation: void authorizations and release dates when confirmation fails; authorization retry window.
- [x] Concurrency test: many overlapping requests at once, exactly one succeeds.

**Other**
- Calendar reconciliation, rescheduling bookings affected by a late return.

### D: Rental and Payment

**Core**
- [x] Payment: demo ledger with fee and deposit authorization, capture, void, and settlement (late fee, deposit release, payout); every operation carries a unique operation ID so a retry never repeats it.
- [x] Payment: payment status per booking for the web.
- [x] Rental: create the rental (idempotent per booking), issue pickup and return codes.
- [x] Rental: confirm pickup (recheck the booking over gRPC, capture the fee, ACTIVE); confirm return (SETTLEMENT_PENDING, release the calendar, settle, CLOSED); internal rental lookup for Review.
- [x] Web: rental page showing codes, code entry, status, and payment status.
- [ ] Slides: risk matrix with at least three risks.

**Should**
- [x] Condition evidence (photos, condition, accessories) at pickup and return.
- [x] Overdue job, late-fee calculation, and return-reminder events.
- [x] Settlement retry endpoint and a test that a duplicate capture is not charged twice.

**Other**
- Real payment provider sandbox, provider reconciliation, deposit-expiry alerts, dispute handling.

### E: Events and Reviews

**Core**
- [x] Outbox in `libs/messaging`: an outbox table that producers write in the same transaction, and a relay that publishes with confirmation and marks entries sent. Help Identity, Listing, Booking, and Rental plug it in.
- [x] Notification: store each event once per recipient in the MongoDB inbox; list the caller's inbox; mark as read.
- [x] Event names and payloads agreed with every producer in `libs/contracts/src/events.ts`.
- [x] Web: inbox page with an unread count.
- [x] Quality attribute: resilience. Stop RabbitMQ during bookings and measure that no booking fails and every event arrives after recovery.

**Should**
- [x] Reviews: submit after a CLOSED rental (participants only, one review each), reputation summary for Listing; web review form.
- [x] Automatic reconnect to RabbitMQ (`amqplib` has a recovery option); a way to inspect dead-lettered events.
- [x] Correlation IDs in every log line, across services and events.

**Other**
- External email and push delivery, broker high availability, a metrics and tracing stack.

## Interfaces between members

Agree these first. Until the real code exists, the owner keeps a stub that answers `501`, so callers can
wire their code. Names below are proposals; the owner finalizes them by the contract freeze.

| Caller → owner | Interface | Kind |
| --- | --- | --- |
| Listing, Booking → Identity | `GET /internal/users/{id}/eligibility` | REST |
| Listing → Identity | `GET /internal/users/{id}/profile` (display name and payout profile) | REST |
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
| Web UI | Build pages from the components and styles in `web/src/ui`; use the CSS variables in `web/src/ui/styles/tokens.css` instead of raw colors. Format money with `formatBaht` and dates with `formatDate` or `formatDateRange` (Asia/Bangkok; a range shows its end as the return day). Copy the patterns at `/ui-preview`. Add new shared parts to `web/src/ui` with role A; keep page-specific parts in your own feature folder. |
| Web API types | No code generation for now: each member has few endpoints and setting up a pipeline costs more than it saves before the code freeze. Write each service's types and calls by hand in one file, `web/src/api/<service>.ts`, to match the service's Swagger page. Return response bodies as classes with `@ApiProperty`, not interfaces, and declare them on the handler with `@ApiOkResponse({ type })` (or `@ApiCreatedResponse`), so Swagger lists them. The `@nestjs/swagger` CLI plugin would infer these, but it does not run under the rspack builder; enabling it changes the shared build, so agree it as a team first. Classes also keep the option to generate types later with `openapi-typescript`. |

## Working without conflicts

- Change only the folders your role owns, unless you have taken over an item as described at the top. If you need a change elsewhere, ask the owner first.
- Push small commits straight to `main` (no pull requests). Run `git pull --rebase` before every push; a branch is optional for longer work.
- Before pushing a change to `booking.proto` or `events.ts`, tell every service that uses it in the team chat.
- Add npm packages in their own small commit; `package.json` is shared.
- If CI fails after your push, fixing it comes before anything else.
- Follow the coding rules in `AGENTS.md`: tests with code, small files, Conventional Commits, one topic at a time.

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
