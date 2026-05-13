import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getRepoRoot } from "../git/git.js";
import { getRepoId } from "../git/repoId.js";
import { listMemories } from "../memory/saveMemory.js";
import { formatMemory } from "../output/format.js";

export async function runList(options: { repo: boolean; limit: string }): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
    process.exit(1);
  }

  const limit = parseInt(options.limit, 10) || 20;
  let repoId: string | undefined;

  if (options.repo) {
    const repoRoot = getRepoRoot(process.cwd());
    if (!repoRoot) {
      console.error("Not inside a git repository.");
      process.exit(1);
    }
    repoId = getRepoId(repoRoot);
  }

  const db = openDb(resolveConfig().storage.dbPath);
  const memories = listMemories(db, { repoId, limit });
  db.close();

  if (memories.length === 0) {
    console.log("No memories found.");
    return;
  }

  for (const memory of memories) {
    console.log(formatMemory(memory));
    console.log("\n---");
  }

  console.log(`\n${memories.length} memory(s) shown.`);
}
