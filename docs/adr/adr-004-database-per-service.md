# ADR-004: Database per Service

## Status

Accepted.

## Context

Shared tables simplify joins but couple service schemas; separate databases support clear ownership at the cost of cross-service coordination. PostgreSQL and MySQL are relational candidates for structured bookings and payments. A document database is another option, but these workflows do not currently need a document-first model. The proposed baseline is PostgreSQL because the design prioritises relational transactions and a consistent database setup across services, not because MySQL is unsuitable.

## Decision

Use PostgreSQL with a separate logical database and credentials per service. A single PostgreSQL instance may host these databases in the course environment. Cross-service access uses published APIs.

## Consequences

Each service controls its schema. The team must create separate credentials, maintain per-service migrations and backups, and test transaction boundaries. Cross-service reads require APIs and failed workflows require recovery logic. Hosting the logical databases on one server reduces setup work but leaves a shared infrastructure failure point.

## Review notes

- The course requires at least one relational and one NoSQL database (see `docs/reference/course-syllabus.md`), while this ADR chooses PostgreSQL for every service, so revisit this decision.
