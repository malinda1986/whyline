import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getRepoRoot } from "../git/git.js";
import { getRepoId } from "../git/repoId.js";
import { searchMemory } from "../memory/searchMemory.js";
import { formatSearchResult } from "../output/format.js";

export async function runSearch(
  query: string,
  options: { file?: string; limit: string }
): Promise<void> {
  if (!isInitialized()) {
    console.error("coding-memory is not initialized. Run `coding-memory init` first.");
    process.exit(1);
  }

  const limit = parseInt(options.limit, 10) || 10;
  const cwd = process.cwd();

  let repoId: string | undefined;
  let repoPath: string | undefined;

  const repoRoot = getRepoRoot(cwd);
  if (repoRoot) {
    repoId = getRepoId(repoRoot);
    repoPath = repoRoot;
  }

  const db = openDb(resolveConfig().storage.dbPath);
  const results = searchMemory(db, {
    query,
    repoId,
    repoPath,
    files: options.file ? [options.file] : [],
    limit,
  });
  db.close();

  if (results.length === 0) {
    console.log("No memories found.");
    return;
  }

  for (const result of results) {
    console.log(formatSearchResult(result));
    console.log("\n---");
  }
}
