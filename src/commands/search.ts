import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getRepoRoot } from "../git/git.js";
import { getRepoId } from "../git/repoId.js";
import { getFileRenameHistory } from "../git/diff.js";
import { searchMemory } from "../memory/searchMemory.js";
import { formatSearchResult } from "../output/format.js";

export async function runSearch(
  query: string,
  options: { file?: string; tag?: string[]; since?: string; before?: string; limit: string }
): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
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

  const files = options.file
    ? (repoPath ? getFileRenameHistory(repoPath, options.file) : [options.file])
    : [];

  const db = openDb(resolveConfig().storage.dbPath);
  const results = searchMemory(db, {
    query,
    repoId,
    repoPath,
    files,
    tags: options.tag ?? [],
    since: options.since,
    before: options.before,
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
