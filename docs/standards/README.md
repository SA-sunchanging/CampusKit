# Documentation Standards

This folder holds the writing standards for CampusKit's formal documents. Each standard applies to
one document type and names the published standard it is based on.

| Standard | Governs | Based on |
| --- | --- | --- |
| `docs/standards/requirements.md` | `docs/requirements.md` | ISO/IEC/IEEE 29148:2018, ISO/IEC 25010:2023, EARS |
| `docs/standards/use-cases.md` | `docs/reference/use-cases.md` | Cockburn, _Writing Effective Use Cases_ (fully dressed form); UML use case diagram |
| `docs/standards/adr.md` | `docs/adr/` | Nygard, "Documenting Architecture Decisions" |

## Where the standards apply

The team writes and submits documents in Google Docs; the Markdown in `docs/` is a replica. The
standards apply to both copies. Fix a violation in the Google Doc first, then sync the replica.

The standards themselves live only in this repository. They are not mirrored from Google Docs.

## Applying a standard

- Write new content to the standard from the start.
- When you notice a violation while working on another topic, report it in one line and leave it.
  Fix it in a session that is about that document.
- Before a submission, run `/review-docs` for a full report of violations and proposed fixes.
