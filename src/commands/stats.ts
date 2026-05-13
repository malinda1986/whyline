import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getStats } from "../memory/saveMemory.js";

export async function runStats(): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
    process.exit(1);
  }

  const db = openDb(resolveConfig().storage.dbPath);
  const stats = getStats(db);
  db.close();

  if (stats.total === 0) {
    console.log("No memories stored yet.");
    return;
  }

  console.log(`Total memories:  ${stats.total}`);
  console.log(`Repos tracked:   ${stats.repos}`);
  console.log(`Oldest memory:   ${stats.oldest}`);
  console.log(`Newest memory:   ${stats.newest}`);

  if (stats.topFiles.length > 0) {
    console.log("\nMost referenced files:");
    for (const { filePath, count } of stats.topFiles) {
      console.log(`  ${count}x  ${filePath}`);
    }
  }
}
