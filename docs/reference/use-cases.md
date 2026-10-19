# CampusKit — Use Cases

> Actors and scope are described in `docs/reference/project-context.md`. Where a step is only
> partly built in the current demo, the text says so.

## UC-1: Publish an Equipment Listing

| Field | Description |
| --- | --- |
| Primary actor | Owner |
| Supporting actors | Platform Administrator. Email Provider is a deferred production actor; the demo delivers notifications through the in-app inbox. |
| Goal | Make an item discoverable and bookable. |
| Trigger | The owner chooses to list an item. |
| Preconditions | The owner is signed in, verified, not suspended, and has a registered payout destination. |
| Success outcome | A published listing contains the item details, prices, pickup options, and availability. |

**Main flow**

1. The owner enters the item's name, category, description, condition, accessories, and replacement value.
2. The owner uploads photographs and sets the daily rate, deposit, and permitted rental duration.
3. The owner chooses campus pickup options and marks unavailable dates.
4. The system validates the information, saves a safe DRAFT, and asks Booking to set up the
   calendar through gRPC. Publication waits until calendar setup succeeds.
5. The system screens the item. Flagged or high-value listings need administrator approval.
6. Once the listing is approved, it becomes searchable and the owner receives a notification.

**Alternative flows**

- **Incomplete or invalid information:** reject the input and explain the validation error. A safe
  DRAFT is created only after validation succeeds, before calendar setup.
- **Rejected listing:** keep the listing unpublished and give the reason. Editing and resubmitting
  it for review remain proposed behaviour; the current UI does not implement the full workflow.
- **Availability cannot be saved:** do not publish the listing until calendar setup succeeds.
- **An existing listing is unpublished:** stop new requests, but keep the terms of confirmed
  bookings. Cancelling those bookings follows the cancellation policy. Full detail editing and
  resubmission remain outside the current demo.

## UC-2: Book and Pay for a Rental

| Field | Description |
| --- | --- |
| Primary actor | Renter |
| Supporting actors | Owner. Payment Gateway and Email Provider are deferred production actors; the demo uses a local payment ledger and in-app notifications. |
| Goal | Reserve an available item for an agreed period. |
| Trigger | The renter needs an item for selected dates. |
| Preconditions | The renter is signed in, verified, eligible to book, and has a supported payment method. The listing is published. |
| Success outcome | A confirmed booking has reserved dates, agreed terms, successful authorization, and a rental record awaiting pickup. |

**Main flow**

1. The renter searches by keyword or category and filters by rental dates and campus location.
2. The system shows matching available listings, with prices and owner review summaries.
3. The renter selects pickup and return times. The system shows the rental fee, deposit,
   cancellation policy, and late-fee rule.
4. When the renter submits, the system rechecks eligibility and availability and reserves the
   requested period atomically.
5. The owner approves or declines the request within the response window.
6. On approval, the system keeps the reservation and requests separate authorizations for the fee
   and the deposit.
7. Once authorization succeeds, the system creates the rental record, confirms the booking, and
   notifies both parties.

**Alternative flows**

- **Dates are no longer available:** reject the request without authorizing payment.
- **The owner declines or does not respond in time:** close the request and release the dates.
- **Authorization fails:** permit retries within a 30-minute window, ending no later than pickup.
  If authorization still fails when the window expires, release the dates and reverse any partial
  authorization that succeeded. The current demo does not enforce a one-retry limit.
- **Confirmation fails after authorization:** retry safely, or cancel and reverse the
  authorization. Track unresolved reversals for administrator attention.
- **Cancellation before pickup:** update the rental if one exists, and release the dates.

## UC-3: Complete the Handover, Return, and Settlement

| Field | Description |
| --- | --- |
| Primary actors | Owner and Renter |
| Supporting actors | Platform Administrator for exceptions. Payment Gateway and Email Provider are deferred production actors; the demo uses a local payment ledger and in-app notifications. |
| Goal | Record pickup and return, then complete settlement. |
| Trigger | A confirmed rental reaches its pickup time. |
| Preconditions | A confirmed booking exists. The demo checks authorization readiness during fee capture at handover and during settlement. Advance payment-readiness checks and alerts remain proposed behaviour. |
| Success outcome | An accepted return is recorded, settlement succeeds, and the rental closes. |

**Main flow**

1. The system checks payment readiness when it processes handover and settlement. Advance checks
   and alerts before pickup remain proposed behaviour.
2. At the agreed location, both parties record pickup photographs, condition, and included
   accessories.
3. The renter confirms the owner's one-time pickup code. The system rechecks authorization and
   captures the fee. Once capture succeeds, it records pickup. The deposit stays reserved.
4. The system tracks the due time and sends a return reminder.
5. At return, both parties first record return photographs, the item's condition, and
   accessories. The owner then confirms the renter's one-time return code to accept the return.
6. After an accepted return, the system marks the item as available again. Items not yet returned
   stay blocked from new requests.
7. The system settles any late fee defined in the agreed booking terms, releases the remaining
   deposit, and pays the owner. This iteration has no claim window and no automated deduction for
   damage or loss.
8. Once settlement succeeds, the rental closes and both parties may submit reviews.

**Alternative flows**

- **Failed pickup:** an invalid code or a failed capture does not confirm the handover. If the item
  is not as described, the renter may refuse it. The booking is then cancelled with no renter
  penalty, and payment is reversed.
- **Late return:** block new requests and identify the future bookings that are affected. Notify
  those renters and offer either an agreed reschedule or full cancellation without penalty. Keep the
  rental open until the return is confirmed.
- **Return not accepted, or item missing:** keep the rental open and the item unavailable. Damage
  and loss claims and their adjudication are outside the platform's current scope. The system
  neither determines compensation nor deducts it automatically.
- **Payment risk or settlement failure:** an expired authorization blocks the affected capture or
  settlement operation and records an error. Keep the custody record, leave an unsettled rental
  open, and retry settlement explicitly after recovery. The demo ledger settles local financial
  changes atomically. Proactive deposit-expiry alerts, partial external-provider settlement
  recovery, and provider reconciliation remain production work.

## Supporting use cases

| ID | Use case | Actors and behaviour |
| --- | --- | --- |
| S-0 | Authenticate Student | The student registers and logs in with email and password to receive a JWT. Logout clears the client token. Authentication identifies the caller and is separate from email and current-student verification. |
| S-1 | Verify Student | The student verifies control of their email address (in demo mode the code is shown on the UI). An administrator separately reviews current-student status. Both checks must happen before publishing or booking and are distinct from authentication. |
| S-2 | Record Condition | Owner and renter record evidence at pickup and at return. Included in UC-3. |
| S-3 | Submit Review | Either participant reviews the other after the rental closes. Closure is a precondition, not an extension relationship. |

## Use-case diagrams

There are two UML use-case diagrams. In both, actors sit outside the system boundary and use cases
appear as ellipses inside it. A solid line means the actor participates in the use case.

**CampusKit — Core rental use cases**

- Owner participates in UC-1, UC-2, and UC-3.
- Renter participates in UC-2 and UC-3.
- Administrator participates in UC-1 and, for technical exceptions, in UC-3.
- Payment Gateway participates in UC-2 and UC-3.
- Email Provider participates in UC-1, UC-2, and UC-3.
- Payment Gateway and Email Provider represent deferred production actors; the demo substitutes the
  local payment ledger and the in-app inbox.
- Caption: verification comes before publishing and booking; rental closure comes before review
  submission.

**CampusKit — Supporting use cases**

- Student (owner / renter) participates in S-0, S-1, UC-3, and S-3.
- Administrator participates in S-1.
- UC-3 «include» S-2 Record Condition.
- Caption: authentication and student verification come before publishing and booking; they are
  preconditions, not included steps of every request.
