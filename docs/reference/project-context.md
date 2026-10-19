# CampusKit — Project Context

> This file holds the domain facts that rarely change: who the project is for, the problem it
> solves, the actors, and the scope. Architecture and technology decisions are kept in the living
> documents under `docs/`, not here.

## Overview

**CampusKit** is a peer-to-peer rental website for current Chulalongkorn University students.
Students can list items they own, rent available items from other students, and arrange pickup
and return on campus.

The project is the term project for course 2110521 Software Architecture (2026/1). Course rules
and deadlines are in `docs/reference/course-syllabus.md`.

## Team

| Name | Student ID |
| --- | --- |
| Chayutphong Soisri | 6630054621 |
| Thara Waranuset | 6630132921 |
| Thanyaporn Rattanacharoentham | 6630138721 |
| Pon Kittinaraporn | 6630237121 |
| Chalisa Wirojratana | 6632045321 |

## Problem and proposed solution

Students sometimes need equipment for only a short time: a camera for a course project, formal
clothing for an interview, a tent for a trip. Buying an item for occasional use can be expensive,
while other students may own a suitable item they are not using.

Arranging rentals through social media and group chats causes several problems:

| Problem | How CampusKit addresses it |
| --- | --- |
| Listings are scattered across conversations and hard to find. | A searchable catalogue brings rental offers together. |
| Owners must coordinate availability manually. | Date-based reservations prevent overlapping bookings. |
| Agreements and transaction status are unclear. | Both parties can view the agreed terms, booking status, and rental history. |
| Item condition at pickup and return is hard to verify. | Pickup and return records preserve photographs and accessories. Dispute adjudication is deferred. |
| Students know little about other participants. | Verified accounts and reviews provide a record of previous rentals. |

These are the problems the project is designed to address. They are not findings from a completed
user survey.

## Actors

| Actor | Main responsibility |
| --- | --- |
| Owner | List personally owned items, set availability, approve requests, and record handovers. |
| Renter | Find an item, request a rental, arrange payment, collect the item, and return it. |
| Platform Administrator | Review student verification and listing approval, and investigate failed payment or notification operations. |
| Payment Gateway | Production external actor that authorizes, captures, releases, refunds, and pays out funds. The current demo uses a local Payment Service ledger adapter without real money. |
| Email Provider | Production external actor that delivers verification messages, booking updates, and reminders. External email and push delivery are deferred; the current demo uses an in-app inbox. |

## Role rules

- Owner and Renter are roles of the same Student account. A student can take either role in
  different transactions.
- A student cannot rent their own item.
- Authentication uses email/password login and a JWT. Authentication identifies the caller; it
  does not by itself make the student eligible.
- Publishing a listing and booking an item both require verified current-student status.
- An email verification code proves control of an email address. In demo mode the code is shown
  on the UI. An administrator reviews current-student status separately.

## Scope of this iteration

**In scope:**

- Authentication (register, login, logout)
- Listing
- Booking
- Demo payment (local ledger, no real money)
- Handover and return
- Reviews
- In-app notifications
- Administrator verification, listing approval, and technical recovery

**Deferred (out of scope for this iteration):**

- Submitting and managing reports
- Damage and loss claims
- Dispute adjudication
- A claim-window workflow
- University Identity Provider integration
- A real payment provider
- External email and push delivery
- Object storage (S3). Demo photographs are compressed inline data URLs.

## Localization

- The demo has Thai and English labels. Complete bilingual localization is deferred.
- All amounts are in THB.

## Before operating with real users

The team must validate identity verification, payment-provider capabilities, TLS, privacy notices,
and data-retention rules before the system is used with real users. These are deployment dependencies,
not claims of completed integration.
