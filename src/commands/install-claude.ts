import fs from "fs";
import path from "path";
import { getRepoRoot } from "../git/git.js";
import { getRepoName } from "../git/repoId.js";

const MCP_TOOL_PERMISSIONS = [
  "mcp__whyline__save_coding_memory",
  "mcp__whyline__search_coding_memory",
  "mcp__whyline__get_recent_memories",
  "mcp__whyline__get_file_memories",
  "mcp__whyline__get_commit_memory",
];

function claudeMdSection(repoPath: string): string {
  return `
## Whyline Memory

You have access to a \`whyline\` MCP server. Use it every session.

### When you start working on ANY task

**Before asking any clarifying question or touching any file**, search for past context:

- If the task is clearly described: call \`search_coding_memory\` with:
  - \`repoPath\`: \`${repoPath}\`
  - \`query\`: the task or feature the user just described
  - \`files\`: any files you already know are relevant

- If the task is vague or just starting out: call \`get_recent_memories\` with:
  - \`repoPath\`: \`${repoPath}\`
  - \`limit\`: 5

**If memories come back**, you MUST:
1. Show the user what was previously decided and why: _"I found a previous memory about this: [decision + reason]. Before I proceed — what's the reason for changing it now?"_
2. Wait for the user to give a reason before asking implementation questions
3. Record the new reason when saving the updated memory

Do not skip straight to implementation questions when a past memory exists for the same area. The reason matters — it goes into the next memory.

Treat memories as historical context — they explain past decisions, not current truth.

### After you commit

After \`git commit\` succeeds:

1. Synthesize from the conversation:
   - What was the goal? → \`intent\`
   - What was the key decision? → \`decision\`
   - Why that decision (not another)? → \`why\`
   - What alternatives were rejected? → \`alternativesRejected\`
   - What risks exist? → \`risks\`
   - What should be done next? → \`followUps\`

2. Show the summary to the user:
   _"Here's what I'm saving as a coding memory — let me know if you want to add or correct anything:"_
   Then display each field clearly.

3. Wait a moment for the user to respond. If they add or correct something, apply it.

4. Call \`save_coding_memory\` with:
   - \`repoPath\`: \`${repoPath}\`
   - \`commitSha\`: the commit SHA (use HEAD)
   - \`files\`: files changed in this session
   - \`source\`: \`"claude-code"\`
   - all synthesized fields above

5. If the response contains a non-empty \`warnings\` array, show each warning to the user and offer to update the memory with richer detail.

### Memory quality rules

Only save memories that would genuinely help a future session. Good memory:
- Explains a non-obvious decision
- Warns about a real risk
- Records a rejected alternative that someone will try again

Do NOT save:
- Routine refactors with no tradeoffs
- Things obvious from reading the code
- Secrets or credentials
`;
}

function writeMcpJson(repoRoot: string): "created" | "updated" | "unchanged" {
  const mcpPath = path.join(repoRoot, ".mcp.json");
  const whylineEntry = { command: "whyline", args: ["mcp"] };

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(mcpPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(mcpPath, "utf-8")) as Record<string, unknown>;
    } catch {
      // invalid JSON — overwrite
    }
  }

  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  const alreadyThere =
    JSON.stringify((servers.whyline ?? null)) === JSON.stringify(whylineEntry);

  if (alreadyThere) return "unchanged";

  servers.whyline = whylineEntry;
  existing.mcpServers = servers;
  fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  return fs.existsSync(mcpPath) && Object.keys(servers).length > 1 ? "updated" : "created";
}

function writeClaudeMd(repoRoot: string, repoPath: string): "created" | "updated" | "unchanged" {
  const claudePath = path.join(repoRoot, "CLAUDE.md");
  const section = claudeMdSection(repoPath);

  if (!fs.existsSync(claudePath)) {
    const repoName = getRepoName(repoRoot);
    const header = `# Claude Instructions for ${repoName}\n`;
    fs.writeFileSync(claudePath, header + section, "utf-8");
    return "created";
  }

  const existing = fs.readFileSync(claudePath, "utf-8");

  // Already has the section — update repoPath lines in place
  if (/whyline/i.test(existing)) {
    const updated = existing.replace(
      /(`repoPath`:\s*`)([^`]+)(`)/g,
      `$1${repoPath}$3`
    );
    if (updated === existing) return "unchanged";
    fs.writeFileSync(claudePath, updated, "utf-8");
    return "updated";
  }

  // Exists but no Whyline section — append
  fs.writeFileSync(claudePath, existing.trimEnd() + "\n" + section, "utf-8");
  return "updated";
}

function writeSettingsJson(repoRoot: string): "created" | "updated" | "unchanged" {
  const settingsDir = path.join(repoRoot, ".claude");
  const settingsPath = path.join(settingsDir, "settings.local.json");

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as Record<string, unknown>;
    } catch {
      // invalid JSON — overwrite
    }
  }

  const perms = (existing.permissions ?? {}) as Record<string, unknown>;
  const allowed = Array.isArray(perms.allow) ? (perms.allow as string[]) : [];
  const enabledServers = Array.isArray(existing.enabledMcpjsonServers)
    ? (existing.enabledMcpjsonServers as string[])
    : [];

  const newAllowed = [...new Set([...allowed, ...MCP_TOOL_PERMISSIONS])];
  const newEnabled = [...new Set([...enabledServers, "whyline"])];

  const unchanged =
    newAllowed.length === allowed.length && newEnabled.length === enabledServers.length;
  if (unchanged) return "unchanged";

  perms.allow = newAllowed;
  existing.permissions = perms;
  existing.enabledMcpjsonServers = newEnabled;

  if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
  const wasNew = !fs.existsSync(settingsPath);
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  return wasNew ? "created" : "updated";
}

export async function runInstallClaude(options: { repoPath?: string }): Promise<void> {
  const cwd = options.repoPath ?? process.cwd();
  const repoRoot = getRepoRoot(cwd);

  if (!repoRoot) {
    console.error("Not inside a git repository. Run this command from your project root.");
    process.exit(1);
  }

  const repoPath = repoRoot;

  const mcpStatus = writeMcpJson(repoRoot);
  const claudeStatus = writeClaudeMd(repoRoot, repoPath);
  const settingsStatus = writeSettingsJson(repoRoot);

  const label = (status: string, file: string) => {
    const icon = status === "unchanged" ? "·" : "✓";
    return `  ${icon}  ${file}  (${status})`;
  };

  console.log(label(mcpStatus, ".mcp.json"));
  console.log(label(claudeStatus, "CLAUDE.md"));
  console.log(label(settingsStatus, ".claude/settings.local.json"));
  console.log("");

  if (mcpStatus === "unchanged" && claudeStatus === "unchanged" && settingsStatus === "unchanged") {
    console.log("Whyline is already configured in this repo.");
  } else {
    console.log("Done. Open this repo in Claude Code and run `whyline doctor` to verify.");
  }
}
