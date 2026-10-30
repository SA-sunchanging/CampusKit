# Risk Matrix

Risks of the CampusKit design and how the system handles them, for the risk-matrix part of the
final presentation (see `docs/reference/course-syllabus.md`). Each risk names the design element
it comes from, so the slide can point at the container view in `docs/architecture/services.md`.

## Scales

| Score | Likelihood | Impact |
| --- | --- | --- |
| 1 | Unlikely in the demo or a term of use | Inconvenience; no data or money is wrong |
| 2 | Possible; happens with ordinary failures such as a restart or a timeout | A workflow stops until someone retries; users wait |
| 3 | Likely; happens without any failure | Money or data is wrong, or every user is blocked |

Risk level = likelihood x impact: 1-2 low, 3-4 medium, 6-9 high.

## Matrix

Rows are impact and columns are likelihood. Each cell lists the risks with that score before
mitigation.

| Impact \ Likelihood | 1 Unlikely | 2 Possible | 3 Likely |
| --- | --- | --- | --- |
| **3 Severe** | R4, R5 | R1 | |
| **2 Moderate** | | R2, R3, R6 | |
| **1 Minor** | | | |

## Risks

| ID | Risk | Cause in the design | L | I | Level | Mitigation in the system | Residual risk | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | A retried payment call charges the renter twice | Booking and Rental call Payment over REST with a 5 second timeout; a timeout after Payment succeeded leads to a retry | 2 | 3 | 6 high | Every Payment request carries a stable operation ID; Payment stores one ledger entry per ID under a unique key and an advisory lock, returns the first result for a repeat, and answers 409 when the ID is reused for another request; integration tests run concurrent duplicate captures | Low: a caller that invents a new ID for the same step is still refused by the one-authorization-per-kind and one-payout-per-booking rules | D |
| R2 | A returned item never settles, so the rental stays open and the owner is not paid | Settlement needs Booking (release the calendar) and Payment (settle) after the return is accepted | 2 | 2 | 4 medium | Rental stores `SETTLEMENT_PENDING`, the return time and the late fee before any remote call; the steps reuse the same operation IDs, so the owner can retry from the rental page, which shows the last error | Medium: the retry is manual; an automatic retry job is planned work | D |
| R3 | Notifications are lost or delayed when RabbitMQ is down | Events travel from each producer to Notification through the broker | 2 | 2 | 4 medium | Producers write events to an outbox in the same transaction as the state change, and a relay publishes with broker confirmation; the queue is durable; Notification deduplicates on event ID and recipient | Low: Listing, Booking and Rental use the shared outbox in `libs/messaging` and Notification reconnects after a broker restart; events arrive late, never lost; business state is never reversed (measured in `docs/architecture/quality-resilience.md`) | E |
| R6 | A fee or deposit authorization expires before pickup or settlement | Bookings can start up to 366 days ahead, but an authorization lasts 30 days by default | 2 | 2 | 4 medium | Payment records the expiry and refuses capture or settlement of an expired hold with 409; Rental keeps the rental in its current state and shows the error; the lifetime is configurable | Medium: re-authorization is not built, so a long-advance booking needs manual handling | D, C |
| R4 | One PostgreSQL failure stops five services | The local deployment runs one PostgreSQL instance with a separate database per service | 1 | 3 | 3 medium | Separate databases and credentials keep a fault in one schema from spreading; persistent volumes and health checks restart cleanly; services fail with 5xx rather than wrong data | Medium: no replica or failover in the course deployment | A |
| R5 | A process inside the network calls an internal endpoint, for example Payment capture, without being a trusted service | Internal endpoints trust any caller that holds a valid service token | 1 | 3 | 3 medium | The gateway refuses every path with an `internal` segment; every internal REST route and every Booking rpc that only services call requires a five-minute service token from a caller on its allowlist (`docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md`); services still check user tokens on public routes | Low: a process that obtains the shared internal secret can sign as any service, and traffic inside the network is not encrypted | A |

## Notes for the slide

- Show the matrix and the three highest risks: R1, then R2 and R3.
- For R1, show the ledger rule and the duplicate-capture test as the evidence.
- For R3, show the resilience measurement in `docs/architecture/quality-resilience.md`.
