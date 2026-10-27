---
name: plan-work
description: Plan a team-plan role, item, or session topic in plan mode, grilling the user with AskUserQuestion until every decision is settled, then build it in the same session after the user accepts the plan.
argument-hint: "<role letter, team-plan item, or session topic>"
disable-model-invocation: true
---

Plan and then build the work named in $ARGUMENTS. If nothing is given, ask which role, item, or
session topic.

Reply in the language the user writes in. Code, comments, and commit messages are in English,
ASCII only.

## Phase 1: plan (plan mode)

1. Enter plan mode with EnterPlanMode (load it with ToolSearch if needed), unless the session is
   already in plan mode. Plan mode is read-only: edit no files and run no git writes.
2. Run `git fetch` (not `git pull`, which writes) and compare with `origin/main`; tell the user
   if the checkout is behind.
3. Read `AGENTS.md`, `docs/team-plan.md`, the docs the work depends on (`docs/architecture/`,
   `docs/adr/`, `docs/reference/`), and the current code in the folders the role owns. Note what
   already exists and can be reused, and what is still a stub.
4. Find today's position in the `docs/team-plan.md` timeline and the syllabus deadlines. Put
   whatever the next deadline needs first.
5. If the target is a role or a large item, split it into sessions (one topic each, AGENTS.md
   "One topic at a time"), show the table (number, session, sub-tasks, needed by, who waits on
   it), and ask with AskUserQuestion which session to plan now. Plan only that one.
6. **Grill the user.** Ask with AskUserQuestion about every decision, small or large, until none
   is open: scope, libraries, business rules (for example token lifetime, limits, error codes),
   schema, naming of files, routes and fields, response shapes, tests, conflicts with a doc,
   and the git name and email to commit as.
   - Put the recommended option first, labelled "(Recommended)", and give every option a
     one-line reason.
   - Group up to four independent questions in one call. Ask in rounds: each answer can open
     new questions, so keep going until nothing is left to decide.
   - Never assume an answer. If the user picks "Other", follow it.
   - When the user does not know the layout, show a short tree of only the touched folders,
     each file marked new or changed, before asking about it.
7. Write the plan and present it with ExitPlanMode. The plan contains:
   - Goal, deadline, and what is out of scope.
   - Every decision the user made, as a short list.
   - Existing code to reuse (paths) and what does not exist yet.
   - The commit series: Conventional Commit message, files (new or changed, repository-relative),
     business rules, and the tests the coding rules require.
   - The checks to run before pushing.
   If the user rejects the plan, ask what to change, adjust, and present it again.

## Phase 2: build (after the user accepts)

1. Follow the accepted plan commit by commit, with tests in the same commit (AGENTS.md coding
   rules).
2. Keep asking with AskUserQuestion, in the same format, whenever something comes up that the
   plan did not settle: a new decision, a failing check with more than one fix, an environment
   problem, or a doubt about a doc. Do not decide alone.
3. Before each push: run every check in AGENTS.md "Tooling notes" for the touched code, run the
   stack when Docker is available, and show the results. Ask before committing and before
   pushing. Run `git pull --rebase` before pushing. Never use `--no-verify`.
4. Do not read `archived/` or the PDFs. Report doc-standard violations in one line only.
5. Finish with a short summary: what was done and tested, which `docs/team-plan.md` items can
   be ticked, and what the next session should do.
