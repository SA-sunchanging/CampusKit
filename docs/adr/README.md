# Architecture Decision Records

This folder holds CampusKit's architecture decision records (ADRs), one decision per file. This page describes the conventions only.

## Structure

Every ADR follows the Nygard structure:

- **Status** — `Proposed`, `Accepted`, `Deprecated`, or `Superseded by <file path>`.
- **Context** — the forces, constraints, and trade-offs behind the decision. Alternatives considered are described here, not in a separate section.
- **Decision** — the selected approach, stated plainly.
- **Consequences** — what becomes easier or harder, and the work and tests the decision requires.

In each file the H1 is `# ADR-NNN: <Title>`, followed by `## Status`, `## Context`, `## Decision`, and `## Consequences`.

## File naming

Name files `adr-NNN-kebab-title.md`, where `NNN` is the next unused three-digit number (for example, `adr-008-some-new-decision.md`).

## Numbers are permanent

ADR numbers are never reused, renumbered, or deleted. To change a decision, write a new ADR and set the old ADR's status to `Superseded by <file path>`, giving the new file's repo-relative path. The new ADR may state `Supersedes <file path>` in its Context.

When an ADR mentions another decision, refer to it by its repo-relative file path, not by its number.

## Adding ADRs

New ADRs are added as course topics introduce new decisions.

## Template

```markdown
# ADR-NNN: <Title>

## Status

Proposed.

## Context

<The forces and constraints. The alternatives considered and their trade-offs.>

## Decision

<The selected approach.>

## Consequences

<What becomes easier or harder. The work and tests this decision requires.>
```
