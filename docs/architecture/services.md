# Services

CampusKit is split into domain microservices behind an API Gateway. The API Gateway routes requests but contains no business logic. Clients call the API Gateway over REST: the Web / Mobile App is used by the Owner and the Renter, and the Admin Console is used by the Administrator. Clients upload and download files directly to and from Object Storage using short-lived signed URLs minted by the services, so zero bytes flow through the microservices.

## External systems

| External system | Reached via |
|---|---|
| Payment Gateway (Omise / Stripe) | PaymentGatewayAdapter, used by the Payment Service |
| University Identity Provider | UniversityIdpAdapter, used by the Student Identity Service |
| Email & Push Providers | Adapters in the Notification Service (an Email Adapter and a Push Adapter) |
| Object Storage (S3) | Clients directly, via short-lived signed URLs minted by services |

## Service catalogue

This table maps every system operation to the service that owns its business capability, so that logic resides in the proper domain. "(scheduled)" marks a time-triggered background job.

| Service | Responsibility | Private DB | Key operations | Collaborators (calls made) |
|---|---|---|---|---|
| **Student Identity Service** | Owns verification, account standing, and eligibility. | `identity_db` | `verifyStudentIdentity()`<br>`checkRentalEligibility()`<br>`applyAccountRestriction()`<br>`requestErasure()`<br>`purgeExpiredIdentityDocuments()` (scheduled) | **Rental / Payment / Review:** `pseudonymiseParty()`<br>**Notification:** `sendNotification()`<br>**External:** IdP, Object Storage |
| **Listing Service** | Owns items, prices, condition evidence specs, and screening. | `listing_db` | `createListing()`<br>`searchListings()`<br>`quoteBooking()`<br>`moderateListing()` | **Student Identity:** `checkRentalEligibility()`<br>**Payment:** `getPayoutDestinationStatus()`<br>**Notification:** `sendNotification()`<br>**External:** Object Storage |
| **Booking Service** | Owns availability calendar and commercial agreements. | `booking_db` | `findAvailableListings()`<br>`requestBooking()`<br>`approveBooking()`<br>`cancelBooking()`<br>`expireStaleRequests()` (scheduled)<br>`reconcileCalendar()` (scheduled) | **Listing:** `getListingDetail()`, `quoteBooking()`<br>**Payment:** `authorizeRentalPayment()`, `voidAuthorization()`<br>**Rental:** `createRental()`, `cancelRental()`<br>**Identity / Notification** |
| **Rental Service** | Owns custody, handovers, overdue states, and settlement orchestration. | `rental_db` | `createRental()`<br>`issueHandoverCode()`<br>`confirmPickup()`<br>`confirmReturn()`<br>`submitConditionReport()`<br>`holdSettlement()`<br>`closeRental()` (scheduled) | **Payment:** `captureRentalFee()`, `settleDeposit()`, `payoutToOwner()`<br>**Review:** `openReviewWindow()`<br>**Notification / Object Storage** |
| **Payment Service** | Owns money movement and the internal ledger. | `payment_db` | `savePaymentMethod()`<br>`authorizeRentalPayment()`<br>`captureRentalFee()`<br>`settleDeposit()`<br>`payoutToOwner()`<br>`reconcileLedger()` (scheduled) | **External:** Payment Gateway (Authorize, Capture, Void, Transfer)<br>**Notification** |
| **Review and Reputation Service** | Owns two-sided reviews. | `review_db` | `submitReview()`<br>`getReputationSummary()`<br>`recordDisputeOutcome()` | **Notification:** `sendNotification()` |
| **Dispute Resolution Service**<br>**Deferred — not built in this iteration** | Owns damage claims and adjudication. | `dispute_db` | `openDispute()`<br>`submitEvidence()`<br>`resolveDispute()`<br>`enforceDisputeCompliance()` (scheduled) | **Rental:** `getRental()`, `holdSettlement()`, `closeRental()`<br>**Identity:** `applyAccountRestriction()`<br>**Payment / Review / Listing / Notification** |
| **Notification Service** | Owns message delivery. | `notification_db` | `sendNotification()`<br>`upsertNotificationContact()`<br>`retryFailedDeliveries()` (scheduled) | **External:** Email Provider, Push Provider |

The Dispute Resolution Service stays in the catalogue but is deferred, consistent with the proposal, which defers dispute adjudication and damage/loss claims (see `docs/adr/adr-001-decompose-by-business-capability.md`).

## Container view

This container view is derived from the Collaborators column of the service catalogue, not traced from the original diagram, whose internal edges were not legible enough to transcribe. Dashed nodes and edges belong to the deferred Dispute Resolution Service.

```mermaid
flowchart LR
  %% Actors
  owner(["Owner"])
  renter(["Renter"])
  admin(["Administrator"])

  %% Client applications
  webapp["Web / Mobile App"]
  console["Admin Console"]

  %% Gateway
  gateway{{"API Gateway"}}

  %% Domain microservices
  subgraph svc ["Microservices"]
    identity{{"Student Identity"}}
    listing{{"Listing"}}
    booking{{"Booking"}}
    rental{{"Rental"}}
    payment{{"Payment"}}
    review{{"Review and Reputation"}}
    dispute{{"Dispute Resolution<br/>(deferred)"}}
    notification{{"Notification"}}
  end

  %% Private databases, one per service
  identityDb[("identity_db")]
  listingDb[("listing_db")]
  bookingDb[("booking_db")]
  rentalDb[("rental_db")]
  paymentDb[("payment_db")]
  reviewDb[("review_db")]
  disputeDb[("dispute_db")]
  notificationDb[("notification_db")]

  %% Adapters
  payAdapter["PaymentGatewayAdapter"]
  idpAdapter["UniversityIdpAdapter"]
  emailAdapter["Email Adapter"]
  pushAdapter["Push Adapter"]

  %% External systems
  payGw["Payment Gateway<br/>(Omise / Stripe)"]
  idp["University Identity Provider"]
  emailProv["Email Provider"]
  pushProv["Push Provider"]
  storage["Object Storage (S3)"]

  %% Clients
  owner --> webapp
  renter --> webapp
  admin --> console
  webapp -- "REST" --> gateway
  console -- "REST" --> gateway
  webapp -- "signed URL" --> storage
  console -- "signed URL" --> storage

  %% Gateway routes requests to the services (no business logic)
  gateway --> svc

  %% Student Identity
  identity --> rental
  identity --> payment
  identity --> review
  identity --> notification
  identity --> idpAdapter --> idp
  identity --> storage

  %% Listing
  listing --> identity
  listing --> payment
  listing --> notification
  listing --> storage

  %% Booking
  booking --> listing
  booking --> payment
  booking --> rental
  booking --> identity
  booking --> notification

  %% Rental
  rental --> payment
  rental --> review
  rental --> notification
  rental --> storage

  %% Payment
  payment --> payAdapter --> payGw
  payment --> notification

  %% Review and Reputation
  review --> notification

  %% Dispute Resolution (deferred)
  dispute -.-> rental
  dispute -.-> identity
  dispute -.-> payment
  dispute -.-> review
  dispute -.-> listing
  dispute -.-> notification

  %% Notification
  notification --> emailAdapter --> emailProv
  notification --> pushAdapter --> pushProv

  %% Private databases
  identity --> identityDb
  listing --> listingDb
  booking --> bookingDb
  rental --> rentalDb
  payment --> paymentDb
  review --> reviewDb
  dispute -.-> disputeDb
  notification --> notificationDb

  classDef deferred stroke-dasharray: 5 5,color:#888888
  class dispute,disputeDb deferred
```

## Open questions

- **Inter-service protocols are not documented yet.** The submissions specify REST only between clients and the API Gateway; calls between services carry no protocol. The course has since taught gRPC and message brokers, and the term project must include REST, gRPC, message-broker and API-gateway components (see `docs/reference/course-syllabus.md`).
- **Student verification differs between submissions.** This catalogue uses a University IdP adapter and identity documents, while the proposal's verification flow uses an email code plus administrator review of student status (see `docs/reference/use-cases.md`).
- **Review and Reputation depends on a deferred service.** `recordDisputeOutcome()` depends on the deferred Dispute Resolution Service.
- **Privacy operations appear only here.** Student Identity's privacy operations (`requestErasure()`, `purgeExpiredIdentityDocuments()`, and the `pseudonymiseParty()` calls it makes to Rental, Payment and Review) appear only in this catalogue, not in the proposal.
- **Service count differs.** The proposal decomposes the system into seven services (see `docs/adr/adr-001-decompose-by-business-capability.md`); this catalogue lists eight because of Dispute Resolution.
- **Some called operations are not in the callee's operation list.** These are called in the Collaborators column but missing from the called service's Key operations: `getListingDetail()`, `getPayoutDestinationStatus()`, `voidAuthorization()`, `cancelRental()`, `getRental()`, `openReviewWindow()`, `pseudonymiseParty()`.
- **The payment provider is named here but deferred elsewhere.** This catalogue names Omise / Stripe, but provider selection is a deferred decision (see `docs/adr/adr-006-isolate-payment-integration-behind-adapter.md`).
- **Push Provider is not a proposal actor.** Notification uses a Push Provider, but the proposal lists only an Email Provider among the actors (see `docs/reference/project-context.md`).
- **`holdSettlement()` serves disputes, which are deferred.** Rental's `holdSettlement()` is called only by the deferred Dispute Resolution Service. Settlement is meant to have no dependency on a dispute service (see `docs/adr/adr-005-orchestrate-workflows-with-idempotent-recovery.md`).
