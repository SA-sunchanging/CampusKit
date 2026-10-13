// PreToolUse guard. The original PDFs and archived/ are reference-only (see AGENTS.md).
// Any tool call that touches them gets an "ask" decision, so the user approves each access.
// Every other call, including unparsable input, passes silently.
import { readFileSync } from "node:fs";

const GUARDS = [
  {
    pattern: /\.pdf\b/i,
    what: "an original PDF (use the transcribed Markdown under docs/reference/ instead)",
  },
  {
    pattern: /(^|[\\/\s"'=])archived([\\/\s"']|$)/i,
    what: "archived/ (old demo code, not a reference)",
  },
];

// Only path-like fields are checked, never file contents or search regexes.
const FIELDS = {
  Read: ["file_path"],
  Edit: ["file_path"],
  Write: ["file_path"],
  NotebookEdit: ["notebook_path"],
  Grep: ["path", "glob"],
  Glob: ["path", "pattern"],
  Bash: ["command"],
  PowerShell: ["command"],
};

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const args = input?.tool_input ?? {};
const targets = (FIELDS[input?.tool_name] ?? [])
  .map((field) => args[field])
  .filter((value) => typeof value === "string");
const hit = GUARDS.find((guard) => targets.some((t) => guard.pattern.test(t)));

if (hit) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `CampusKit guard: ${input.tool_name} wants to access ${hit.what}. Approve only if you explicitly asked for this.`,
      },
    }),
  );
}
