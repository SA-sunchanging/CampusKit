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

## Tooling notes

- The guard hook needs Node.js and bash; on Windows, bash means Git Bash. The hook is
  `.claude/hooks/guard-paths.mjs`, registered in `.claude/settings.json`.
- The backend is a NestJS 12 monorepo: ES modules (relative imports end in `.js`), rspack builds,
  Vitest tests, oxlint. Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:all`.
- PostgreSQL services change their schema only through migrations listed in
  `apps/<service>/src/migrations/index.ts`; `synchronize` stays off.
