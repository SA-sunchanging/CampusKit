---
name: review-docs
description: Review CampusKit's requirements, use cases, or ADRs against docs/standards/ and report proposed fixes. Takes a target - requirements, use-cases, adr, all, or a Google Docs link.
argument-hint: "requirements | use-cases | adr | all | <Google Docs link>"
disable-model-invocation: true
---

Run the docs-reviewer subagent (Agent tool, subagent_type docs-reviewer) instead of reviewing the
documents yourself. Pass it the target: $ARGUMENTS. If no target is given, ask the user which one.

Relay its report to the user briefly, in Thai. The agent edits nothing; the user decides which
proposals to apply. Fixes go to the Google Doc first, then the replica in `docs/` is synced.
