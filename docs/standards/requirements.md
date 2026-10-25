# Requirements Standard

This standard governs `docs/requirements.md` and its Google Docs original. It follows the
characteristics of good requirements in ISO/IEC/IEEE 29148:2018, groups quality requirements by
ISO/IEC 25010:2023, and phrases conditional behaviour with EARS (Easy Approach to Requirements
Syntax).

## Document structure

The requirements document has these sections, in this order:

1. **Glossary** — every domain term that a requirement uses with a specific meaning.
2. **Functional requirements** (`FR-NN`) — what the system shall do.
3. **Non-functional requirements** (`NFR-NN`) — how well the system shall do it, grouped by quality
   characteristic.
4. **Constraints** (`C-NN`) — fixed choices that limit the design, such as a mandated technology, a
   course rule, or a deployment environment.
5. **Assumptions** — facts taken as true but not confirmed, each with who must confirm it.

A table may carry a "Supports" column that names the use case by title, never by ID.

## Writing a requirement

- Write each requirement as one sentence: "The system shall …". A section may state the prefix
  once ("Each requirement below reads 'The system shall …'") and omit it from the rows.
- Use "shall" for a requirement. Do not use "should", "may", "will", or "must" in requirement text.
- Use the EARS pattern that fits:

| Pattern | Template |
| --- | --- |
| Ubiquitous | The system shall _response_. |
| Event-driven | When _trigger_, the system shall _response_. |
| State-driven | While _state_, the system shall _response_. |
| Unwanted behaviour | If _condition_, then the system shall _response_. |
| Optional feature | Where _feature is included_, the system shall _response_. |

## Quality checklist

Each requirement must be:

1. **Singular** — one capability or one constraint. A row that joins distinct behaviours with
   "and", commas, or a list is split.
2. **Verifiable** — a tester can decide pass or fail. Vague words ("fast", "easy", "appropriate",
   "support", "handle", "user-friendly") are replaced with a measure or a named constant.
3. **Unambiguous** — it has only one reading. Pronouns and terms resolve to the glossary.
4. **Implementation-free** — it states what, not how. A technology, protocol, or design appears
   only in a constraint.
5. **Feasible** — it can be built within the course scope and the stated constraints.
6. **Necessary** — it traces to a use case, a stakeholder need, or a course requirement.

The whole document must be:

7. **Consistent** — no requirement contradicts another requirement, the glossary, a constraint, or
   an assumption.
8. **Complete** — every capability named in the glossary, an NFR, or a use case has a functional
   requirement that defines it.
9. **Free of duplicates** — no two requirements say the same thing.
10. **Internally referenced** — every ID mentioned in the document exists and points at the
    requirement the text means.

## Non-functional requirements

- Group NFRs under ISO/IEC 25010 characteristics: performance efficiency, reliability, security,
  maintainability, compatibility, usability (interaction capability), flexibility, and safety.
  Use only the characteristics that apply.
- Each NFR states the measure, the target value, the conditions under which it holds, and the
  verification method (test, analysis, inspection, or demonstration).
- An NFR states an acceptance target. Do not report a measured result in the requirements document.

## Identifiers

- IDs are `FR-NN`, `NFR-NN`, and `C-NN`, numbered in file order.
- When a requirement is split, the first part keeps the original ID and the others take letter
  suffixes (`FR-04a`, `FR-04b`). Renumber to a clean sequence only when the team asks.
- IDs appear only in `docs/requirements.md`. Other documents refer to the file, never to an ID.

## Examples

| Not compliant | Why | Compliant |
| --- | --- | --- |
| Manage listings, photographs, prices, moderation, and availability. | Not singular; "manage" is not verifiable. | The system shall let an owner create a listing with a name, category, description, daily rate, and deposit. |
| Deliver updates through RabbitMQ and the Notification Service's MongoDB inbox. | Names technology. | When a booking changes state, the system shall notify the renter and the owner. (RabbitMQ and MongoDB move to constraints.) |
| Search is fast. | Not verifiable. | The system shall return search results within 1 second at the 95th percentile under the stated test load. |
