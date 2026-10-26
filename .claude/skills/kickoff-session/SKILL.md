---
name: kickoff-session
description: Start a new cloud session that implements a plan agreed in this conversation, with an instruction to ask the user about every decision through AskUserQuestion.
argument-hint: "<session topic, for example identity: register/login>"
disable-model-invocation: true
---

Start a new cloud session for $ARGUMENTS, using the plan agreed earlier in this conversation. If
no plan was agreed, run the same steps as `/plan-item` first and get the user's approval.

Reply in the language the user writes in.

1. Get the repository URL with `git remote get-url origin`.
2. Call `create_session` (claude-code-remote MCP; load it with ToolSearch if needed) with
   `source_url` set to that URL, a short title, the model the user asks for (default: this
   session's model), and no `plan` permission mode. Effort cannot be set; say so if asked.
3. Write the prompt in English so it stays self-contained. Include:
   - Read AGENTS.md first and follow it.
   - Reply to the user in the language they write in; code, comments, and commits in English,
     ASCII only.
   - **Ask the user about every decision, small or large, with AskUserQuestion:** libraries,
     business rules (for example token lifetime, limits, error codes), schema and naming,
     problems met while working, doubts about the docs, and when to commit and push. Put the
     recommended option first, labelled "(Recommended)", and give every option a one-line
     reason. Group up to four independent questions in one call. Never assume an answer.
   - Goal, deadline, and what is out of scope.
   - Existing code to reuse (paths) and what does not exist yet.
   - The commit series: messages, files, business rules, tests. Present the proposed defaults
     as recommendations to offer, not as settled decisions.
   - Before pushing: run every check in AGENTS.md "Tooling notes", run the stack when Docker is
     available, show the results, and ask before committing and before pushing.
   - Ask which git name and email to commit as before the first commit.
   - Do not read `archived/` or the PDFs; report doc-standard violations in one line only.
   - Finish with a summary of what was done and tested, and what the next session should do.
4. Tell the user the session title and ID, and what the prompt instructs.
