# Quality Attribute: Resilience

The measured quality attribute for the term project. It asks one question: when the message broker
fails, do rentals keep working, and does every notification still arrive once the broker is back?

## Scenario

| Part | Value |
|---|---|
| Source | Operator or infrastructure fault |
| Stimulus | RabbitMQ stops for 60 seconds while students book |
| Artifact | Booking, Listing, Rental (producers), RabbitMQ, Notification (consumer) |
| Environment | Local Docker Compose stack, normal load |
| Response | Bookings succeed during the outage; events wait in each producer's outbox and reach the inbox after recovery, once each |
| Measure | Failed bookings, notices delivered, duplicate notices, delay from broker restart to delivery |

Target: 0 failed bookings, 100% of notices within 60 seconds of the restart, 0 duplicates.

## Design that provides it

- Producers write each event to an outbox table in the same PostgreSQL transaction as the state
  change, so a booking commits without the broker (see
  `docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md`).
- A relay in each producer publishes unsent rows and marks them sent only after the broker
  confirms; while the broker is down it retries every second.
- Notification's consumer reconnects in the background (1 s doubling to 30 s), stores one inbox
  entry per (`eventId`, `recipient`) with an upsert, and acknowledges after the write, so a
  redelivered event does not create a second notice.

`docs/architecture/services.md` has the details of the outbox, the consumer and the inbox.

## Method

`apps/notification/e2e/broker-outage.mjs`, against the running stack
(`docker compose up --build -d`, `npm run seed`):

1. The demo owner creates a listing; the script waits for `listing.published` in the owner's
   inbox to prove the event path works.
2. `docker compose stop rabbitmq`.
3. The demo renter requests 20 one-day bookings on different days and the owner approves each one
   (Booking, Payment and Rental all run during the outage).
4. The script checks that none of the 60 expected notices is in an inbox yet:
   `booking.requested` to the owner and `booking.confirmed` to both, per booking.
5. After 60 seconds of downtime, `docker compose start rabbitmq`.
6. The script polls both inboxes every 0.5 seconds for up to 60 seconds and records when each
   notice first appears and whether any appears twice.

## Results

Run on 29 Oct 2026, one developer laptop (Windows 11, Docker Desktop):

| Run | Bookings confirmed during outage | Notices during outage | Notices after restart | Duplicates | Delay p50 | Delay max | Result |
|---|---|---|---|---|---|---|---|
| 1 | 20 / 20 | 0 / 60 | 60 / 60 | 0 | 14.7 s | 14.7 s | Pass |
| 2 | 20 / 20 | 0 / 60 | 60 / 60 | 0 | 14.3 s | 14.3 s | Pass |
| 3 | 20 / 20 | 0 / 60 | 60 / 60 | 0 | 14.7 s | 14.7 s | Pass |

Downtime was 60.6 seconds in each run.

## Reading the results

- **Availability of the business flow:** every booking was requested, approved and confirmed while
  the broker was down. The broker is not on the request path.
- **No loss:** all 60 notices arrived after recovery, although none could be delivered during the
  outage. They waited as unsent outbox rows.
- **No duplicates:** the upsert on (`eventId`, `recipient`) absorbs at-least-once delivery.
- **Recovery time:** p50 and max are the same because the backlog arrives in one burst. The delay
  is RabbitMQ's own start-up time plus the wait for the next reconnect attempt of the consumer
  (backoff up to 30 seconds), not the time to process 60 events. A shorter backoff cap would
  lower it at the cost of more connection attempts during a long outage.

## Limits

- One broker node and one run environment; broker high availability is out of scope.
- The inbox shows the newest 50 notices, so the script measures 20 bookings (40 owner notices).
- Events written while the broker is down are delivered late, not in real time; the web badge
  catches up within its 30-second poll.
