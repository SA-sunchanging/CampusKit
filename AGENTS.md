# AGENTS.md

Context for any coding agent working in this repository.

## Project

CampusKit is a peer-to-peer rental website for Chulalongkorn University students. It is the team's
term project for 2110521 Software Architecture (first semester 2026, Wednesday section). The course
requires a microservice system, and the architecture documents grow as the course teaches each
topic.

## Where things are

| Path | Contents | Stability |
| --- | --- | --- |
| `docs/reference/course-syllabus.md` | Course facts, grading, deadlines, term-project requirements, weekly topics | Stable (transcribed from the syllabus) |
| `docs/reference/project-context.md` | Problem, team, actors, role rules, scope | Stable |
| `docs/reference/use-cases.md` | Core and supporting use cases | Stable |
| `docs/requirements.md` | Functional and non-functional requirements | Living |
| `docs/adr/` | Architecture decision records; conventions are in its README | Living |
| `docs/architecture/` | Service catalogue, container view, sequences, service discovery, open questions | Living |
| `docs/team-plan.md` | Roles, Core/Should/Other work per member, interfaces between members, timeline | Living |
| `docs/reference/sources/` | PDFs exported from the team's Google Docs and the syllabus | Guarded: open only when asked |
| `apps/` | One NestJS application per service, plus the API gateway | Code |
| `libs/` | Shared code: `common`, `contracts` (proto and event envelope), `messaging` | Code |
| `web/` | React + TypeScript web app (Vite) | Code |
| `infra/`, `compose.yaml`, `Dockerfile` | Local deployment with Docker Compose | Code |
| `archived/` | Old demo code | Off-limits |

- **Stable** files change only when their source changes, for example when the syllabus is reissued
  or the team changes a use case.
- **Living** files are expected to change as the course progresses.
- `README.md` explains how to run the code.

## Rules

1. **Open the PDFs in `docs/reference/sources/` only when the user asks.** The Markdown files in
   `docs/` mirror them. A project hook asks the user for approval before any tool touches a `.pdf`
   path.
2. **The team's Google Docs outrank this repository.** The team writes and submits documents in
   Google Docs, exported as PDFs. Those are always newer than the Markdown here, which may lag
   behind. When they disagree, follow the PDF or ask the user which is current, then update the
   Markdown so the repository stays current. Keep `docs/` up to date whenever a decision changes.
3. **`archived/` is not a reference.** Do not read it, copy from it, cite it, or base new code on
   it unless the user explicitly names a file there. The same hook asks before any access.
   `.ignore` keeps the folder out of content searches (Grep), but file listings (Glob) still
   show it. Ignore those entries.
4. **Question surprising requests.** If the user asks for something that contradicts a document or
   seems odd for this project, say so: name the file and the conflicting point, and ask before you
   act. Once the user confirms, update the document.
5. **The course is incremental.** A deliverable adds an architecture element only after the course
   has taught that topic. To find the current week, compare today's date with the schedule in
   `docs/reference/course-syllabus.md`.
6. **Cross-reference at file level only.** When one document refers to another, give its path.
   Never cite another file's IDs (use-case, requirement, or ADR numbers), section numbers, or line
   numbers, because these change. A file may use its own IDs internally.
7. **Write documentation in English.** Keep Thai only where the original wording matters.
8. **Respect service ownership.** Each service owns its database; never read another service's
   tables or collections. Cross-service calls go through REST, gRPC (`libs/contracts/proto`), or
   events (`libs/contracts/src/events.ts`). Keep `libs/` free of business logic.

## Coding rules

1. **Write tests with the code.** A test lives next to its file (`foo.ts` → `foo.spec.ts`) and
   lands in the same commit. Every business rule, state transition, idempotency path, and
   concurrency guard needs a test. Plain controllers and module wiring do not. There is no
   coverage target.
2. **Keep files and functions small.** Aim for under about 300 lines per file and 50 lines per
   function; split by responsibility once a file grows past that. These are soft limits, judged
   in review.
3. **Follow the NestJS layering.** Controllers only map requests to providers; logic lives in
   providers. Every request body and query is a DTO validated with class-validator. Log with
   Nest `Logger`, never `console`. Read configuration from environment variables; never commit
   secrets. Throw `HttpException` subclasses so the error filter in `libs/common` returns the
   shared error shape.
4. **Pass lint and format.** Code passes oxlint (type-aware) and Prettier. Every `any` carries a
   comment saying why it is needed. Await every promise or mark it with `void`.
5. **Use Conventional Commits.** `type(scope): summary`, where type is `feat`, `fix`, `refactor`,
   `test`, `docs`, `style`, `build`, `ci`, or `chore`, and scope is the service or library, for
   example `feat(listing): add search by campus`. Each member commits under their own name,
   because Git contribution is graded.
6. **One topic at a time.** The team pushes small commits straight to `main` (no pull requests);
   a branch named `<type>/<topic>`, for example `feat/listing-search`, is optional for longer
   work. When a request covers more than one topic, or a topic that does not belong on the
   current branch, say so before acting and propose a numbered split (1, 2, 3, …), one commit
   series each. Wait for the user to choose. Run `git pull --rebase` before pushing.
7. **Never bypass the hooks.** Do not use `--no-verify`; fix what the hook reports.

## Tooling notes

- The guard hook needs Node.js and bash; on Windows, bash means Git Bash. The hook is
  `.claude/hooks/guard-paths.mjs`, registered in `.claude/settings.json`.
- The backend is a NestJS 12 monorepo: ES modules (relative imports end in `.js`), rspack builds,
  Vitest tests, oxlint. Checks: `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm test`, `npm run build:all`; for the web app, `npm run lint` and `npm run build` in `web/`.
- Git hooks (husky, installed by `npm install`): pre-commit runs lint-staged (oxlint and
  Prettier on staged files), commit-msg runs commitlint, and pre-push runs typecheck and tests.
  CI in `.github/workflows/ci.yml` runs every check on each push to any branch; it reports
  failures after the push and does not block it, so whoever breaks it fixes it first.
- The backend lint config is `.oxlintrc.json`; the web app has its own in `web/`.
- PostgreSQL services change their schema only through migrations listed in
  `apps/<service>/src/migrations/index.ts`; `synchronize` stays off.
