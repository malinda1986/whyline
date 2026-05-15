import path from "path";
import { getRepoRoot } from "../git/git.js";
import { ClaudeAdapter } from "../adapters/claude.js";
import { CursorAdapter } from "../adapters/cursor.js";
import type { ToolAdapter, WriteResult } from "../adapters/types.js";

const ADAPTERS: Record<string, ToolAdapter> = {
  claude: new ClaudeAdapter(),
  cursor: new CursorAdapter(),
};

export async function runInstall(options: { tool: string; repoPath?: string }): Promise<void> {
  const cwd = options.repoPath ?? process.cwd();
  const repoRoot = getRepoRoot(cwd);

  if (!repoRoot) {
    console.error("Not inside a git repository. Run this command from your project root.");
    process.exit(1);
  }

  const adapter = ADAPTERS[options.tool];
  if (!adapter) {
    const supported = Object.keys(ADAPTERS).join(", ");
    console.error(`Unknown tool "${options.tool}". Supported tools: ${supported}`);
    process.exit(1);
  }

  const results: { file: string; result: WriteResult }[] = [];

  results.push({ file: adapter.configPath, result: adapter.writeConfig(repoRoot) });
  results.push({ file: adapter.instructionPath, result: adapter.writeInstructions(repoRoot, repoRoot) });
  if (adapter.writePermissions) {
    const r = adapter.writePermissions(repoRoot);
    results.push({ file: path.relative(repoRoot, r.path), result: r });
  }

  const label = (status: string, file: string) => {
    const icon = status === "unchanged" ? "·" : "✓";
    return `  ${icon}  ${file}  (${status})`;
  };

  for (const { file, result } of results) {
    console.log(label(result.status, file));
  }
  console.log("");

  const allUnchanged = results.every((r) => r.result.status === "unchanged");
  if (allUnchanged) {
    console.log("Whyline is already configured in this repo.");
  } else {
    console.log(`Done. Open this repo in ${adapter.displayName} and run \`whyline doctor\` to verify.`);
  }
}
