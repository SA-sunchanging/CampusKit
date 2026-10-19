# ADR-004: Database per Service with Relational and Document Stores

## Status

Accepted.

## Context

Shared tables simplify joins but couple service schemas. Reservations, custody, and financial records need transactions and relational constraints; reviews and notification inbox entries fit document storage. PostgreSQL and MySQL are viable relational options; PostgreSQL is retained for Booking's range/exclusion constraints and the existing relational setup. MongoDB provides document storage for reviews and inbox records. The course implementation requires both an RDBMS and a NoSQL database; using two technologies adds operational work compared with the original all-PostgreSQL baseline.

This record was revised in place for the final project description, replacing the earlier all-PostgreSQL decision.

## Decision

Use PostgreSQL for Student Identity (`identity_db`), Listing (`listing_db`), Booking (`booking_db`), Rental (`rental_db`), and Payment (`payment_db`). Use MongoDB for Review and Reputation (`review_db`) and Notification (`notification_db`). Each service owns a separate logical database and credentials. The local deployment shares one PostgreSQL instance and one MongoDB instance. Cross-service access uses published APIs rather than another service's tables or collections.

## Consequences

Each service controls its schema. PostgreSQL enforces reservation constraints and unique financial operation identifiers; MongoDB compound unique indexes prevent duplicate reviews and inbox records. Maintain per-service migrations and index setup, credentials, backups, and recovery tests for both technologies. Separate logical databases preserve ownership, while shared instances remain infrastructure failure points. Cross-service reads require APIs and failed workflows require recovery logic.
