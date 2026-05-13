import * as readline from "readline";
import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getMemoryById, deleteMemory } from "../memory/saveMemory.js";

function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export async function runDelete(id: string, options: { force: boolean }): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
    process.exit(1);
  }

  const db = openDb(resolveConfig().storage.dbPath);
  const memory = getMemoryById(db, id);

  if (!memory) {
    db.close();
    console.error(`Memory not found: ${id}`);
    process.exit(1);
  }

  console.log(`Memory: ${memory.id}`);
  console.log(`Intent: ${memory.intent}`);
  if (memory.commitSha) console.log(`Commit: ${memory.commitSha.slice(0, 8)}`);

  if (!options.force) {
    const ok = await confirm("\nDelete this memory? (y/N) ");
    if (!ok) {
      db.close();
      console.log("Cancelled.");
      return;
    }
  }

  deleteMemory(db, id);
  db.close();
  console.log(`Deleted ${id}`);
}
