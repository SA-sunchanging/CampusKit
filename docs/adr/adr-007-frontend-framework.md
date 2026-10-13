# ADR-007: Frontend Framework

## Status

Accepted.

## Context

The project needs responsive student and administrator web interfaces for listings, booking, handover, and payment status. Compare React with TypeScript and Vue 3 with TypeScript on component structure, setup effort, and learning cost. Both support TypeScript; using one language across the stack does not distinguish them.

| Dimension | React with TypeScript | Vue 3 with TypeScript |
|---|---|---|
| Component structure | JSX/TSX keeps rendering logic close to TypeScript; reusable typed components and hooks. | Single-file components group templates, logic, and styles; reusable logic through the Composition API. |
| Advantages for this project | Retains the proposed React baseline and supports shared listing cards, booking forms, and status views. | Provides an explicit template structure and component organisation suited to the same interfaces. |
| Costs and learning | Requires agreed routing/data-fetching tools, plus JSX, hooks, and state conventions. | Requires learning template directives, reactivity, and .vue files; switching would change the proposed frontend conventions. |
| TypeScript support | Supported; a shared language is useful but does not distinguish the two choices. | Supported; a shared language is useful but does not distinguish the two choices. |

**Selection rationale:** retain the proposed React baseline to avoid changing direction within one term, and accept the extra tooling decisions. Vue remains a viable alternative. This is a project-specific continuity trade-off; it does not assume greater React experience or a universal performance advantage.

## Decision

Use React with TypeScript for the student and administrator web interfaces. Keep one shared frontend project with reusable components and a documented routing, API-access, and form-handling convention. Backend framework selection is outside this frontend ADR.

## Consequences

Reusing components and typed API models can keep the web interfaces consistent. The team must document dependency versions, build/test commands, routing and data-fetching choices, and loading/error states. Members unfamiliar with React need onboarding time, and JSX/hooks require agreed review conventions. Validate the accessibility and small-viewport requirement in `docs/requirements.md` with keyboard access, labelled forms, and a 360-pixel viewport. The frontend consumes published APIs and does not contain authoritative permission, availability, or settlement rules.
