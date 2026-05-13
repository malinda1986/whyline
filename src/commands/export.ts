import fs from "fs";
import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getRepoRoot } from "../git/git.js";
import { getRepoId } from "../git/repoId.js";
import { getAllMemories } from "../memory/saveMemory.js";
import type { CodingMemory } from "../memory/types.js";

function memoryToMarkdown(memory: CodingMemory): string {
  const lines: string[] = [];
  lines.push(`# ${memory.id}`);
  lines.push(`Created: ${memory.createdAt}`);
  if (memory.commitSha) lines.push(`Commit: ${memory.commitSha}`);
  if (memory.repoName) lines.push(`Repo: ${memory.repoName}`);
  if (memory.files.length) lines.push(`Files: ${memory.files.join(", ")}`);
  if (memory.tags.length) lines.push(`Tags: ${memory.tags.join(", ")}`);
  lines.push("");
  if (memory.task) { lines.push("Task:", memory.task, ""); }
  lines.push("Intent:", memory.intent, "");
  lines.push("Summary:", memory.summary, "");
  lines.push("Decision:", memory.decision, "");
  lines.push("Why:", memory.why, "");
  if (memory.alternativesRejected.length) {
    lines.push("Alternatives rejected:");
    for (const a of memory.alternativesRejected) lines.push(`- ${a}`);
    lines.push("");
  }
  if (memory.risks.length) {
    lines.push("Risks:");
    for (const r of memory.risks) lines.push(`- ${r}`);
    lines.push("");
  }
  if (memory.followUps.length) {
    lines.push("Follow-ups:");
    for (const fu of memory.followUps) lines.push(`- ${fu}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function runExport(options: {
  format: string;
  output?: string;
  repo: boolean;
  since?: string;
  before?: string;
  tag: string[];
}): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
    process.exit(1);
  }

  const db = openDb(resolveConfig().storage.dbPath);
  let memories = getAllMemories(db);
  db.close();

  if (options.repo) {
    const repoRoot = getRepoRoot(process.cwd());
    if (!repoRoot) {
      console.error("Not inside a git repository.");
      process.exit(1);
    }
    const repoId = getRepoId(repoRoot);
    memories = memories.filter((m) => m.repoId === repoId);
  }

  if (options.since) {
    const sinceMs = new Date(options.since).getTime();
    memories = memories.filter((m) => new Date(m.createdAt).getTime() >= sinceMs);
  }
  if (options.before) {
    const beforeMs = new Date(options.before).getTime();
    memories = memories.filter((m) => new Date(m.createdAt).getTime() <= beforeMs);
  }
  if (options.tag.length > 0) {
    const lowerTags = options.tag.map((t) => t.toLowerCase());
    memories = memories.filter((m) => {
      const mTags = m.tags.map((t) => t.toLowerCase());
      return lowerTags.every((t) => mTags.includes(t));
    });
  }

  const output =
    options.format === "md"
      ? memories.map(memoryToMarkdown).join("\n---\n\n")
      : JSON.stringify({ schemaVersion: 1, memories }, null, 2);

  if (options.output) {
    fs.writeFileSync(options.output, output, "utf-8");
    console.error(`Exported ${memories.length} memory(s) to ${options.output}`);
  } else {
    process.stdout.write(output + "\n");
  }
}
