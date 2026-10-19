# ADR-009: Backend Framework

## Status

Proposed.

## Context

Seven services and an API gateway must be built by a five-person team within a few weeks. The frontend uses React with TypeScript (see `docs/adr/adr-007-frontend-framework.md`), so a TypeScript backend lets the team share one language, one toolchain, and typed models. Plain Express leaves every service to invent its own structure for modules, validation, and configuration. NestJS supplies that structure, has first-party transports for REST, gRPC, and RabbitMQ, and has official TypeORM and Mongoose modules. Its decorators and dependency injection add learning cost for members who have not used it.

## Decision

Build the API gateway and all seven services with NestJS in one Nest monorepo: one application per service under `apps/`, shared code under `libs/`, and one root `package.json`. Each application builds into its own container image and runs as its own container. Use TypeORM for the PostgreSQL services and Mongoose for the MongoDB services. Booking exposes gRPC through `@nestjs/microservices`; Notification consumes RabbitMQ.

## Consequences

Services share conventions for modules, validation, configuration, health checks, and OpenAPI documentation, and shared libraries need no package publishing. One root `package.json` means dependency changes can conflict between members, so add dependencies in small, separate commits. Shared libraries must stay small and free of business logic so that services remain independently deployable. Booking's exclusion constraint needs a raw SQL migration, because TypeORM entities cannot declare it. Members new to NestJS need onboarding time.
