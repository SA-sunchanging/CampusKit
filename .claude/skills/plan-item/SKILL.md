---
name: plan-item
description: Break a team-plan role or item into sessions, then one session into commits and files, with the decisions the user must make. Read-only planning; edits nothing.
argument-hint: "<role letter, team-plan item, or session topic>"
disable-model-invocation: true
---

Plan the work named in $ARGUMENTS. If nothing is given, ask which role or item.

Reply in the language the user writes in. Edit no files and run no git writes.

1. Read `docs/team-plan.md`, the docs the item depends on (`docs/architecture/`, `docs/adr/`,
   `docs/reference/`), and the current code in the folders the role owns. Note what already
   exists and can be reused, and what is still a stub.
2. Find today's position in the `docs/team-plan.md` timeline and the syllabus deadlines. Put
   whatever the next deadline needs first.
3. If the target is a role or a large item, split it into sessions: one topic each (AGENTS.md
   "One topic at a time"). Give a table: number, session, sub-tasks, needed by. Mark which
   sessions other members are waiting on.
4. If the target is one session, break it into a commit series. For each commit give the
   Conventional Commit message, the files (new or changed, repository-relative), the business
   rules, and the tests the coding rules require. State what is out of scope.
5. When the user does not know the layout, show a short tree of only the touched folders, mark
   each file new or changed, and say in one line what each layer does.
6. End with the open decisions (library, business rule, conflict with a doc). Give a recommended
   option and a one-line reason for each. Name any doc that conflicts, at file level only.

Keep it short: tables and bullets, no restating of the docs.
