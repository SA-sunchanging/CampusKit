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
| `docs/architecture/` | Service catalogue, container view, open questions | Living |
| `docs/reference/sources/` | The original PDFs | Guarded: do not open |
| `archived/` | Old demo code | Off-limits |

- **Stable** files change only when their source changes, for example when the syllabus is reissued
  or the team changes a use case.
- **Living** files are expected to change as the course progresses.

## Rules

1. **Never open the PDFs in `docs/reference/sources/`.** The Markdown files in `docs/reference/`
   replace them. Open a PDF only when the user explicitly asks for that specific file. A project
   hook asks the user for approval before any tool touches a `.pdf` path.
2. **`archived/` is not a reference.** Do not read it, copy from it, cite it, or base new code on
   it unless the user explicitly names a file there. The same hook asks before any access.
   `.ignore` keeps the folder out of content searches (Grep), but file listings (Glob) still
   show it. Ignore those entries.
3. **Documents can be out of date.** If the user asks for something that contradicts a document,
   say so: name the file and the conflicting point, and ask which version is current before you
   act. Once the user confirms, update the document so it stays the source of truth.
4. **The course is incremental.** A deliverable adds an architecture element only after the course
   has taught that topic. To find the current week, compare today's date with the schedule in
   `docs/reference/course-syllabus.md`.
5. **Cross-reference at file level only.** When one document refers to another, give its path.
   Never cite another file's IDs (use-case, requirement, or ADR numbers), section numbers, or line
   numbers, because these change. A file may use its own IDs internally.
6. **Write documentation in English.** Keep Thai only where the original wording matters.

## Tooling notes

The guard hook needs Node.js and bash; on Windows, bash means Git Bash. The hook is
`.claude/hooks/guard-paths.mjs`, registered in `.claude/settings.json`.
