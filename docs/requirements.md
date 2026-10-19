# Requirements

The use cases these requirements support are described in `docs/reference/use-cases.md`.

## Functional requirements

| ID | Requirement | Supports |
|---|---|---|
| FR-01 | Authenticate students with JWTs, verify email and current-student status, and enforce role, resource-ownership, and rental-participant permissions at protected services. | authentication; student verification |
| FR-02 | Manage listings, photographs, prices, moderation, and availability. | listing publication |
| FR-03 | Search by category, keyword, dates, and campus location; show review summaries. | booking and payment |
| FR-04 | Generate and preserve quotes and atomically reserve dates; support approval, rejection, expiry, and cancellation. | booking and payment |
| FR-05 | Track fee and deposit authorization, capture, release, refund, and payout through a payment adapter. | booking and payment; handover, return and settlement |
| FR-06 | Record pickup and return through one-time codes and condition evidence. | handover, return and settlement; condition recording |
| FR-07 | Detect overdue rentals, calculate late fees, block unavailable items, and handle affected bookings. | handover, return and settlement |
| FR-08 | Support participant reviews, booking/rental history, and itemised payment status. | booking and payment; handover, return and settlement; reviews |
| FR-09 | Deliver updates and reminders through PostgreSQL transactional outbox events, RabbitMQ, and the Notification Service's MongoDB inbox. Track recoverable workflow errors. External email and push delivery are deferred. | listing publication; booking and payment; handover, return and settlement |

## Non-functional requirements

These are acceptance targets, not measured results. Planned performance testing uses 300 concurrent virtual users, 1,500 listings, a documented request mix, and the payment test adapter.

| ID | Requirement and verification |
|---|---|
| NFR-01 | Under the stated test load, p95 search latency is at most 1 second and single-resource reads at most 500 ms. Server errors remain below 0.5%; expected business rejections are counted separately. Verify by load testing. |
| NFR-02 | Concurrent requests cannot create overlapping reservations. Retried operations cannot duplicate a capture, deduction, refund, or payout. Verify with concurrency and timeout-after-success tests. |
| NFR-03 | Production target: external access uses HTTPS and internal calls use TLS. The local Docker demo uses HTTP and insecure gRPC. Private evidence and transactions require authorised access; raw card data is not stored or logged. Verify permissions and logs locally; verify TLS before production deployment. |
| NFR-04 | Each service owns its database and supports independent deployment through compatible API contracts. Verify database permissions and consumer contract tests. |
| NFR-05 | A notification outage does not reverse a successful rental operation. Failed deliveries and payment steps remain recoverable and traceable with correlation IDs. Verify by simulated outages and recovery. |
| NFR-06 | Acceptance target: the three core use cases work on a 360-pixel-wide viewport without horizontal scrolling, with labelled forms and keyboard access. At least four of five users with preverified test accounts can find an item and submit a request within 10 minutes. Responsive layout checks and the five-user usability study are separate validations; the study has not been completed. |
| NFR-07 | Acceptance targets: RPO 24 hours and RTO 4 hours for PostgreSQL and MongoDB. Verify backups and recovery through a restoration exercise; persistent Docker volumes alone do not demonstrate these targets. A completed backup/restore drill and real-provider payment reconciliation after recovery remain outstanding. |
