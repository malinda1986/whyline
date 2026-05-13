import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getMemoryById, updateMemory, buildEmbeddingText } from "../memory/saveMemory.js";
import { parseSummary } from "../memory/parseSummary.js";
import type { CodingMemory } from "../memory/types.js";

function serializeToMarkdown(memory: CodingMemory): string {
  const lines: string[] = [];
  if (memory.task) { lines.push("Task:", memory.task, ""); }
  lines.push("Intent:", memory.intent, "");
  lines.push("Summary:", memory.summary, "");
  lines.push("Decision:", memory.decision, "");
  lines.push("Why:", memory.why, "");
  lines.push("Alternatives rejected:");
  for (const a of memory.alternativesRejected) lines.push(`- ${a}`);
  lines.push("");
  lines.push("Risks:");
  for (const r of memory.risks) lines.push(`- ${r}`);
  lines.push("");
  lines.push("Follow-ups:");
  for (const fu of memory.followUps) lines.push(`- ${fu}`);
  lines.push("");
  lines.push("Tags:");
  for (const t of memory.tags) lines.push(`- ${t}`);
  return lines.join("\n");
}

export async function runEdit(id: string): Promise<void> {
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

  const tmpFile = path.join(os.tmpdir(), `whyline-edit-${id}.md`);
  fs.writeFileSync(tmpFile, serializeToMarkdown(memory));

  const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
  try {
    execSync(`${editor} "${tmpFile}"`, { stdio: "inherit" });
  } catch {
    fs.unlinkSync(tmpFile);
    db.close();
    console.error("Editor exited with error. No changes saved.");
    process.exit(1);
  }

  const edited = fs.readFileSync(tmpFile, "utf-8");
  fs.unlinkSync(tmpFile);

  const parsed = parseSummary(edited);
  const updates = {
    intent: parsed.intent,
    summary: parsed.summary,
    decision: parsed.decision,
    why: parsed.why,
    task: parsed.task,
    alternativesRejected: parsed.alternativesRejected,
    risks: parsed.risks,
    followUps: parsed.followUps,
    tags: parsed.tags,
    embeddingText: buildEmbeddingText({ ...memory, ...parsed }),
  };

  updateMemory(db, id, updates);
  db.close();
  console.log(`Updated ${id}`);
}
