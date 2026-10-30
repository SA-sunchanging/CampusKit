# Observability: Metrics, Traces, and Alerts

How CampusKit shows what its services are doing and catches failures that no user sees. The
week-13 lecture calls these silent failures: nothing crashes, but work stops moving, for example
events that wait in an outbox while RabbitMQ is down. This is extra work beyond the term-project
minimum; the measured quality attribute stays resilience (`docs/architecture/quality-resilience.md`).

## Parts

| Part | Where | What it does |
| --- | --- | --- |
| OpenTelemetry SDK | `libs/common/src/telemetry/instrument.ts`, loaded by every backend service before it starts | Traces HTTP, gRPC, PostgreSQL, MongoDB, and RabbitMQ calls; serves metrics on port 9464 |
| Jaeger | `infra/observability/compose.yaml`, UI on http://localhost:16686 | Stores and shows traces, received over OTLP/HTTP on `jaeger:4318` |
| Prometheus | Same file, http://localhost:9090 | Scrapes every service's port 9464 every 5 seconds by Compose DNS name; evaluates the alert rules |
| Grafana | Same file, http://localhost:3030 | Dashboard "CampusKit overview" with Prometheus and Jaeger as data sources |

Jaeger, Prometheus, and Grafana run only with the Compose profile `observability`:

```sh
docker compose --profile observability up --build -d
```

The plain `docker compose up` and the load tests stay as they were. The SDK runs either way; with
no Jaeger it drops the traces. `OTEL_SDK_DISABLED=true` turns it off. Port 9464 is not published
and the gateway does not route to it, so metrics are visible only inside the Compose network.

## Traces

- The SDK starts before the service code (`node --import` in the `Dockerfile`), because the
  services are ES module bundles and only a loader hook can patch the packages they import.
- A trace follows one request through the gateway and every service it calls, over REST and gRPC,
  down to each SQL statement and MongoDB command.
- Health checks and metric scrapes are not traced. Database queries outside a traced request
  (the outbox relays poll every second) are not traced either, so Jaeger shows only real work.
- Publishing an event and consuming it form their own trace: the outbox relay publishes later,
  outside the request. RabbitMQ message headers carry that trace from the producer to
  Notification.

### Following one request to its events

Every span carries the tag `campuskit.correlation_id`, the same ID the gateway puts in the
`x-correlation-id` header, in every log line (`[cid=...]`), and in every event envelope. To
follow a booking approval:

1. Take the `x-correlation-id` from the response headers, or from a log line.
2. In Jaeger, search service `gateway` with the tag `campuskit.correlation_id=<id>`: the request
   trace (gateway, Booking, Payment, Rental).
3. Search service `booking` with the same tag: the event trace (Booking's relay publishes,
   Notification stores the inbox entries).

Log lines inside a traced request also show `[trace=<trace ID>]`, which opens the trace directly
in Jaeger.

## Metrics

| Metric | From | Meaning |
| --- | --- | --- |
| `http_server_request_duration` (histogram, seconds) | Every HTTP service | Requests by route and status code: rate, errors, latency |
| `campuskit_outbox_pending` (gauge) | Identity, Listing, Booking, Rental | Events not yet confirmed by RabbitMQ, counted at each scrape |
| `campuskit_events_consumed_total` (counter) | Notification | Events handled, by `decision`: `ack`, `dead-letter`, `requeue` |
| `campuskit_dead_letters_total` (counter) | Notification | Dead-lettered messages kept for inspection |
| `nodejs_eventloop_delay_p99` and other runtime metrics | Every service | A blocked event loop shows here first |

Prometheus adds a `service` label (for example `service="listing"`) to every series.

## Alerts

The rules are in `infra/observability/alerts.yml`. They show at http://localhost:9090/alerts; no
message is sent anywhere.

| Alert | Fires when | Usually means |
| --- | --- | --- |
| `ServiceDown` | A service has not answered a scrape for 30 seconds | The container stopped or is stuck |
| `OutboxBacklog` | A service keeps unsent events for 2 minutes | RabbitMQ is down or refuses events; users still succeed, notices wait |
| `DeadLetters` | Notification kept a dead letter in the last 10 minutes | A producer sent an event that does not match the envelope |

Checked on 30 Oct 2026 against the running stack: with RabbitMQ stopped, the rental flow
(`apps/rental/e2e/rental-flow.mjs`) still passed, `OutboxBacklog` fired for Booking, Listing,
and Rental after 2 minutes, and after RabbitMQ restarted the outboxes drained and the alert
resolved within seconds.

## Demo script (about one minute)

1. Open Grafana "CampusKit overview" and Jaeger side by side.
2. Approve a booking in the web app; show the request rate move, then the approval trace in
   Jaeger crossing gateway, Booking (gRPC), Payment, and Rental.
3. `docker compose stop rabbitmq`, approve another booking: it still succeeds, and "Outbox events
   waiting" rises.
4. `docker compose start rabbitmq`: the count drops to 0 and the inbox shows the notices.
