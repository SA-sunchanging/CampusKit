// PostToolUse hook. When a tool touches a governed document, add its writing standard from
// docs/standards/ to the agent's context (see AGENTS.md). Each standard is added once per session.
// Every other call, including unparsable input, passes silently.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

// Path patterns are matched against tool_input.file_path with forward slashes.
const MAP = [
  { pattern: /(^|\/)docs\/requirements\.md$/i, standard: "requirements.md" },
  { pattern: /(^|\/)docs\/reference\/use-cases\.md$/i, standard: "use-cases.md" },
  { pattern: /(^|\/)docs\/adr\/adr-[^/]+\.md$/i, standard: "adr.md" },
];

// A Google Doc ID does not say which document it is, so these tools get the index.
const GOOGLE_DOCS = /^mcp__claude_ai_Google_Docs__/;

const REMINDER =
  "If the current task is not about this document, do not fix violations of the standard: " +
  "report them in one line at the end of your reply.";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const toolName = input?.tool_name ?? "";
const filePath = String(input?.tool_input?.file_path ?? "").replace(/\\/g, "/");
const standard = GOOGLE_DOCS.test(toolName)
  ? "README.md"
  : MAP.find((entry) => entry.pattern.test(filePath))?.standard;
if (!standard) process.exit(0);

const session = String(input?.session_id ?? "unknown").replace(/[^\w-]/g, "_");
const markerDir = join(tmpdir(), "campuskit-doc-standards");
const marker = join(markerDir, `${session}-${standard}`);
if (existsSync(marker)) process.exit(0);

let text;
try {
  text = readFileSync(join(ROOT, "docs", "standards", standard), "utf8");
} catch {
  process.exit(0);
}
mkdirSync(markerDir, { recursive: true });
writeFileSync(marker, "");

const intro =
  standard === "README.md"
    ? "CampusKit documents in Google Docs follow the standards indexed below. Once you know the " +
      "document type, read the matching file in docs/standards/."
    : `CampusKit writing standard for this document (docs/standards/${standard}):`;

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `${intro}\n${REMINDER}\n\n${text}`,
    },
  }),
);
