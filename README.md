# CampusKit

A peer-to-peer rental website for Chulalongkorn University students, built as microservices for
2110521 Software Architecture. The architecture is in `docs/architecture/services.md`, decisions are in
`docs/adr/`, and who builds what is in `docs/team-plan.md`.

## How the repository is laid out

Each service is a separate program with its own database. They run as separate containers and talk
only through APIs, gRPC, or RabbitMQ events, never through each other's database.

```
apps/                     one NestJS application per service (one container each)
  gateway/                public entry point :3000; forwards /api/<service>/... to the service
  identity/  listing/  rental/  payment/       REST services on PostgreSQL
  booking/                gRPC service on PostgreSQL (:50051; /health on :3007)
  review/  notification/  REST services on MongoDB; notification also consumes RabbitMQ
  <service>/compose.yaml  how Docker runs that service
  <service>/src/migrations/  PostgreSQL schema changes for that service
libs/                     small shared code, no business logic
  common/                 bootstrap, /health, JWT guard, correlation IDs, error shape, DB settings
  contracts/              the agreements between services: booking.proto and the event envelope
  messaging/              RabbitMQ event publisher
web/                      React + TypeScript (Vite); one folder per feature in src/features/
infra/                    PostgreSQL, MongoDB, RabbitMQ and their init scripts
loadtest/                 k6 scripts
scripts/dev-token.mjs     makes a test JWT before login works
```

All backend apps share one `package.json` (a Nest monorepo). Import shared code as `@app/common`,
`@app/contracts`, or `@app/messaging`.

## Run everything

Needs Docker Desktop.

```sh
docker compose up --build
```

- Web app: http://localhost:8080
- Gateway: http://localhost:3000 (Swagger at http://localhost:3000/docs)
- Every service: `GET /api/<service>/health` through the gateway, for example `/api/listing/health`
- RabbitMQ console: http://localhost:15672 (user `campuskit`, password `campuskit`)

Unimplemented endpoints answer `501 Not Implemented`.

## Work on one service

Run the databases and broker in Docker and your service on your machine, so it reloads on save:

```sh
npm install
npm run infra                      # postgres, mongo, rabbitmq in Docker
npm run start:dev -- listing       # your service; Swagger at http://localhost:3002/docs
```

Other services default to `localhost` addresses, so start any service you call the same way, in another
terminal. For the web app: `cd web && npm install && npm run dev` (it forwards `/api` to the gateway on
port 3000).

To call a protected endpoint before login exists, make a token:

```sh
node scripts/dev-token.mjs <userId> student
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/listing/listings
```

## Checks before pushing

`npm install` sets up Git hooks: staged files are linted and formatted on commit, commit messages
must follow Conventional Commits, and typecheck and tests run on push. CI runs the full list below
on every push; coding rules are in `AGENTS.md`.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build:all
(cd web && npm run lint && npm run build)
```

## Ports

| Service | Port |
| --- | --- |
| gateway | 3000 |
| identity | 3001 |
| listing | 3002 |
| rental | 3003 |
| payment | 3004 |
| review | 3005 |
| notification | 3006 |
| booking | 50051 (gRPC), 3007 (health and docs) |
| web | 8080 (Docker), 5173 (`npm run dev`) |
| postgres / mongo / rabbitmq | 5432 / 27017 / 5672, 15672 |

Database users and passwords are demo values from `infra/postgres/init.sql` and `infra/mongo/init.js`.
If you change an init script, recreate the volumes with `docker compose down -v`, which deletes local
data.
