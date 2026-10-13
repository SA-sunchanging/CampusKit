# Requirements

The use cases these requirements support are described in `docs/reference/use-cases.md`.

## Functional requirements

| ID | Requirement | Supports |
|---|---|---|
| FR-01 | Verify students and enforce account, participant, and administrator permissions. | student verification |
| FR-02 | Manage listings, photographs, prices, moderation, and availability. | listing publication |
| FR-03 | Search by category, keyword, dates, and campus location; show review summaries. | booking and payment |
| FR-04 | Generate and preserve quotes and atomically reserve dates; support approval, rejection, expiry, and cancellation. | booking and payment |
| FR-05 | Track fee and deposit authorization, capture, release, refund, and payout through a payment adapter. | booking and payment; handover, return and settlement |
| FR-06 | Record pickup and return through one-time codes and condition evidence. | handover, return and settlement; condition recording |
| FR-07 | Detect overdue rentals, calculate late fees, block unavailable items, and handle affected bookings. | handover, return and settlement |
| FR-08 | Support participant reviews, booking/rental history, and itemised payment status. | booking and payment; handover, return and settlement; reviews |
| FR-09 | Send updates and reminders; track failed payments and notifications for recovery and administrator review. | listing publication; booking and payment; handover, return and settlement |

## Non-functional requirements

These are acceptance targets, not measured results. Performance testing uses 300 concurrent virtual users, 1,500 listings, a documented request mix, and the payment test adapter.

| ID | Requirement and verification |
|---|---|
| NFR-01 | Under the stated test load, p95 search latency is at most 1 second and single-resource reads at most 500 ms. Server errors remain below 0.5%; expected business rejections are counted separately. Verify by load testing. |
| NFR-02 | Concurrent requests cannot create overlapping reservations. Retried operations cannot duplicate a capture, deduction, refund, or payout. Verify with concurrency and timeout-after-success tests. |
| NFR-03 | External access uses HTTPS. Private evidence and transactions are restricted to authorised users; raw card data is not stored or logged. Verify with access-control tests and log inspection. |
| NFR-04 | Each service owns its database and supports independent deployment through compatible API contracts. Verify database permissions and consumer contract tests. |
| NFR-05 | A notification outage does not reverse a successful rental operation. Failed deliveries and payment steps remain recoverable and traceable with correlation IDs. Verify by simulated outages and recovery. |
| NFR-06 | The three core use cases work on a 360-pixel-wide viewport without horizontal scrolling, with labelled forms and keyboard access. At least four of five users with preverified test accounts can find an item and submit a request within 10 minutes. Verify by walkthrough and usability test. |
| NFR-07 | Database recovery targets are an RPO of 24 hours and an RTO of 4 hours. Reconcile unresolved payment outcomes after recovery before retrying money operations. Verify through a restoration exercise. |
