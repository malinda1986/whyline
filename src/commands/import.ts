import fs from "fs";
import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { saveMemory, getMemoryById } from "../memory/saveMemory.js";
import { redactSecrets } from "../memory/redactSecrets.js";
import type { CodingMemory } from "../memory/types.js";

const VALID_SOURCES = new Set(["manual", "claude-code", "cli", "hook"]);

function validateMemory(obj: unknown): CodingMemory | null {
  if (!obj || typeof obj !== "object") return null;
  const m = obj as Record<string, unknown>;
  if (
    typeof m.id !== "string" ||
    typeof m.createdAt !== "string" ||
    typeof m.updatedAt !== "string" ||
    typeof m.repoId !== "string" ||
    typeof m.intent !== "string" ||
    typeof m.summary !== "string" ||
    typeof m.decision !== "string" ||
    typeof m.why !== "string" ||
    !Array.isArray(m.files) ||
    !Array.isArray(m.tags) ||
    !Array.isArray(m.alternativesRejected) ||
    !Array.isArray(m.risks) ||
    !Array.isArray(m.followUps) ||
    typeof m.embeddingText !== "string"
  ) {
    return null;
  }
  const source = VALID_SOURCES.has(m.source as string)
    ? (m.source as CodingMemory["source"])
    : "manual";
  return {
    id: m.id,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    repoId: m.repoId,
    repoPath: typeof m.repoPath === "string" ? m.repoPath : undefined,
    repoName: typeof m.repoName === "string" ? m.repoName : undefined,
    branch: typeof m.branch === "string" ? m.branch : undefined,
    commitSha: typeof m.commitSha === "string" ? m.commitSha : undefined,
    task: typeof m.task === "string" ? m.task : undefined,
    intent: redactSecrets(m.intent),
    summary: redactSecrets(m.summary),
    decision: redactSecrets(m.decision),
    why: redactSecrets(m.why),
    files: (m.files as unknown[]).filter((f): f is string => typeof f === "string"),
    tags: (m.tags as unknown[]).filter((t): t is string => typeof t === "string"),
    alternativesRejected: (m.alternativesRejected as unknown[]).filter((a): a is string => typeof a === "string").map(redactSecrets),
    risks: (m.risks as unknown[]).filter((r): r is string => typeof r === "string").map(redactSecrets),
    followUps: (m.followUps as unknown[]).filter((f): f is string => typeof f === "string").map(redactSecrets),
    source,
    embeddingText: m.embeddingText,
    rawTranscriptPath: typeof m.rawTranscriptPath === "string" ? m.rawTranscriptPath : undefined,
  };
}

export async function runImport(filePath: string): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
    process.exit(1);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Cannot read file: ${filePath}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("File is not valid JSON. Only JSON exports are supported for import.");
    process.exit(1);
  }

  // Accept both v1 envelope { schemaVersion, memories } and legacy bare arrays
  let items: unknown[];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (
    parsed &&
    typeof parsed === "object" &&
    "memories" in (parsed as object) &&
    Array.isArray((parsed as Record<string, unknown>).memories)
  ) {
    items = (parsed as Record<string, unknown>).memories as unknown[];
  } else {
    items = [parsed];
  }
  const db = openDb(resolveConfig().storage.dbPath);

  let imported = 0;
  let skipped = 0;
  let invalid = 0;

  for (const item of items) {
    const memory = validateMemory(item);
    if (!memory) {
      invalid++;
      continue;
    }
    const existing = getMemoryById(db, memory.id);
    if (existing) {
      skipped++;
      continue;
    }
    saveMemory(db, memory);
    imported++;
  }

  db.close();

  console.log(`Import complete: ${imported} imported, ${skipped} skipped (already exist), ${invalid} invalid.`);
}
