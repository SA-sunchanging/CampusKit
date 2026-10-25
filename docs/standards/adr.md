# Architecture Decision Record Standard

This standard governs the ADRs in `docs/adr/` and their Google Docs originals. It follows Michael
Nygard's format from "Documenting Architecture Decisions" (2011).

## Structure

Every ADR has these sections:

- **Status** — `Proposed`, `Accepted`, `Deprecated`, or `Superseded by <file path>`.
- **Context** — the forces, constraints, and trade-offs behind the decision. Alternatives
  considered are described here, not in a separate section.
- **Decision** — the selected approach, stated plainly.
- **Consequences** — what becomes easier or harder, and the work and tests the decision requires.

In each file the H1 is `# ADR-NNN: <Title>`, followed by `## Status`, `## Context`, `## Decision`,
and `## Consequences`.

## File naming

Name files `adr-NNN-kebab-title.md`, where `NNN` is the next unused three-digit number (for
example, `adr-010-some-new-decision.md`).

## Numbers are permanent

ADR numbers are never reused, renumbered, or deleted. To change a decision, write a new ADR and set
the old ADR's status to `Superseded by <file path>`, giving the new file's repo-relative path. The
new ADR may state `Supersedes <file path>` in its Context.

When an ADR mentions another decision, refer to it by its repo-relative file path, not by its
number.

**Exception: revisions in a submitted document.** If a submitted Google Doc revises an ADR under
its existing number, mirror that revision in place here so the numbers match what was submitted,
and say in the ADR's Context that it was revised in place. Outside that case, the supersede rule
above applies.

## Source of truth

The submitted Google Docs are always newer than the files in `docs/adr/`, which may lag behind.
When the two disagree, follow the Google Doc or ask the team which is current, then update the
file to match.

## Quality checklist

1. **One decision** — the ADR records a single decision. A second decision gets its own ADR.
2. **Decision-named title** — the title states the decision ("Database per Service"), not only the
   topic ("Database"). A topic-only title is acceptable when the Decision section states the choice
   in its first sentence.
3. **Forces before options** — the Context states the problem and the forces (quality attributes,
   constraints, course rules) before it lists alternatives.
4. **Real alternatives** — the Context names at least two options that were seriously considered,
   each with its main trade-off.
5. **Active decision** — the Decision is written in the active voice ("We will …" or an imperative
   sentence) and is specific enough to implement.
6. **Honest consequences** — the Consequences include negative effects and risks, not only
   benefits, and name the tests or work the decision requires.
7. **Neutral context** — the Context describes the situation without arguing for the chosen
   option.
8. **Implementation-level detail stays out** — configuration values, code, and step-by-step
   procedures belong in the architecture documents or the code, not in the ADR.

## Template

```markdown
# ADR-NNN: <Title>

## Status

Proposed.

## Context

<The problem and the forces. The alternatives considered and their trade-offs.>

## Decision

<The selected approach.>

## Consequences

<What becomes easier or harder, including risks. The work and tests this decision requires.>
```
