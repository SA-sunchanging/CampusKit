# Use Case Standard

This standard governs `docs/reference/use-cases.md` and its Google Docs original. UML defines the
use case diagram but not the text of a use case. The text follows Alistair Cockburn's "fully
dressed" form from _Writing Effective Use Cases_, the common standard for use case descriptions.

## Use case diagram

The document may open with one UML use case diagram for the whole system, drawn in Mermaid or
PlantUML. It shows the system boundary, the actors, the use cases by title, and any `«include»` or
`«extend»` relations. The diagram summarises the text and never replaces it.

## Template

Each use case has a heading `UC-N: <Title>`, a field table, and three flow sections.

```markdown
## UC-N: <Verb phrase title>

| Field | Description |
| --- | --- |
| Scope | <The system under design, for example "CampusKit platform".> |
| Level | <User goal or Subfunction.> |
| Primary actor | <The actor whose goal this use case serves.> |
| Supporting actors | <Other actors or external systems the system calls on.> |
| Stakeholders and interests | <Each stakeholder and what they need protected or achieved.> |
| Preconditions | <What the system guarantees is true before the use case starts.> |
| Trigger | <The event that starts the use case.> |
| Minimal guarantee | <What the system ensures on every outcome, including failure.> |
| Success guarantee | <What is true when the goal is achieved.> |

**Main success scenario**

1. <Actor> <does something>.
2. The system <does something>.

**Extensions**

- **2a. <Condition>:**
  1. The system <does something>.
  2. The use case resumes at step 3. / The use case ends in failure.

**Open issues**

- <A question the team has not resolved yet.>
```

## Quality checklist

1. **Goal-named** — the title is an active verb phrase that states the primary actor's goal
   ("Book and Pay for a Rental"), not a feature name ("Booking Module").
2. **Actor in every step** — each step names who acts: an actor or the system.
3. **One action per step** — a step that joins several actions is split.
4. **No user interface or technology** — steps describe intent ("The renter selects the rental
   dates"), not screens, buttons, protocols, or services ("clicks Submit", "calls Booking through
   gRPC"). Technology belongs in the architecture documents.
5. **Numbered extensions** — each extension is labelled with the step it branches from and a letter
   (`4a`, `4b`). Its sub-steps are numbered `4a1`, `4a2`.
6. **Closed extensions** — every extension ends by resuming at a named step or by ending in
   failure.
7. **Guarantees match the flows** — the success guarantee holds at the end of the main scenario,
   and the minimal guarantee holds at the end of every extension.
8. **Consistent with requirements** — every behaviour in a use case has a functional requirement in
   `docs/requirements.md`, and the use case uses the glossary's terms.
9. **Demo scope stated once** — when part of a use case is not built in the current demo, say so in
   the open issues, not inside a step.

## Identifiers

Use case IDs (`UC-N`) appear only in `docs/reference/use-cases.md`. Other documents refer to a use
case by its title.
