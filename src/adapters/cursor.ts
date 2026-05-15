import fs from "fs";
import path from "path";
import type { ToolAdapter, WriteResult } from "./types.js";

function cursorRulesSection(repoPath: string): string {
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
1. STOP. Do not read any file yet.
2. Quote the memory to the user verbatim: _"I found a previous memory about this: [decision + reason]. Before I proceed — what's the reason for changing it now?"_
3. If the memory has \`isStale: true\`, add: _"Note: this memory is over 90 days old — verify it still applies before treating it as current."_
4. Wait for the user to respond before doing anything else.
5. Record the new reason when saving the updated memory.

**If no memories come back**, say "No past memories found for this area" and then proceed normally.

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

3. Wait for the user to respond. If they add or correct something, apply it.

4. Call \`save_coding_memory\` with:
   - \`repoPath\`: \`${repoPath}\`
   - \`commitSha\`: the commit SHA (use HEAD)
   - \`files\`: files changed in this session
   - \`source\`: \`"cursor"\`
   - all synthesized fields above

5. If the response contains a non-empty \`warnings\` array, show each warning and offer to update the memory with richer detail.

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

export class CursorAdapter implements ToolAdapter {
  readonly toolName = "cursor";
  readonly displayName = "Cursor";
  readonly configPath = ".cursor/mcp.json";
  readonly instructionPath = ".cursorrules";

  writeConfig(repoRoot: string): WriteResult {
    const cursorDir = path.join(repoRoot, ".cursor");
    const mcpPath = path.join(cursorDir, "mcp.json");
    const whylineEntry = { command: "whyline", args: ["mcp"] };
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(mcpPath)) {
      try { existing = JSON.parse(fs.readFileSync(mcpPath, "utf-8")) as Record<string, unknown>; } catch { /* overwrite */ }
    }
    const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
    if (JSON.stringify(servers.whyline ?? null) === JSON.stringify(whylineEntry)) {
      return { path: mcpPath, status: "unchanged" };
    }
    const wasMulti = Object.keys(servers).length > 0;
    servers.whyline = whylineEntry;
    existing.mcpServers = servers;
    if (!fs.existsSync(cursorDir)) fs.mkdirSync(cursorDir, { recursive: true });
    fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
    return { path: mcpPath, status: wasMulti ? "updated" : "created" };
  }

  writeInstructions(repoRoot: string, repoPath: string): WriteResult {
    const rulesPath = path.join(repoRoot, ".cursorrules");
    const section = cursorRulesSection(repoPath);
    if (!fs.existsSync(rulesPath)) {
      fs.writeFileSync(rulesPath, section.trimStart(), "utf-8");
      return { path: rulesPath, status: "created" };
    }
    const existing = fs.readFileSync(rulesPath, "utf-8");
    if (/whyline/i.test(existing)) {
      const updated = existing.replace(/(`repoPath`:\s*`)([^`]+)(`)/g, `$1${repoPath}$3`);
      if (updated === existing) return { path: rulesPath, status: "unchanged" };
      fs.writeFileSync(rulesPath, updated, "utf-8");
      return { path: rulesPath, status: "updated" };
    }
    fs.writeFileSync(rulesPath, existing.trimEnd() + "\n" + section, "utf-8");
    return { path: rulesPath, status: "updated" };
  }
}
