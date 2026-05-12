import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getMemoryById, getMemoryByCommit } from "../memory/saveMemory.js";
import { formatMemory } from "../output/format.js";

export async function runShow(
  id: string | undefined,
  options: { commit?: string }
): Promise<void> {
  if (!isInitialized()) {
    console.error("coding-memory is not initialized. Run `coding-memory init` first.");
    process.exit(1);
  }

  const db = openDb(resolveConfig().storage.dbPath);

  let memory = null;

  if (options.commit) {
    memory = getMemoryByCommit(db, options.commit);
  } else if (id) {
    memory = getMemoryById(db, id);
  } else {
    db.close();
    console.error("Error: provide a memory ID or use --commit <sha>");
    process.exit(1);
  }

  db.close();

  if (!memory) {
    console.error(`Memory not found: ${options.commit ?? id}`);
    process.exit(1);
  }

  console.log(formatMemory(memory, true));
}
