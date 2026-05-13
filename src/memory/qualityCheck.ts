import type Database from "better-sqlite3";
import type { CodingMemory } from "./types.js";
import { getMemoriesByRepoId } from "./saveMemory.js";

const FILLER_PHRASES = [
  "done", "fixed", "fixed it", "updated", "changed", "refactored",
  "wip", "misc", "test", "testing", "cleanup", "fix", "update",
  "unspecified intent", "unspecified decision", "unspecified rationale",
];

const MIN_FIELD_LENGTH = 20;

export type QualityWarning = {
  field: string;
  message: string;
};

export type DuplicateWarning = {
  type: "same-commit" | "similar-intent";
  existingId: string;
  message: string;
};

export function checkQuality(memory: Pick<CodingMemory, "intent" | "decision" | "why">): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  const checks: Array<{ field: string; value: string }> = [
    { field: "intent", value: memory.intent },
    { field: "decision", value: memory.decision },
    { field: "why", value: memory.why },
  ];

  for (const { field, value } of checks) {
    const trimmed = value.trim().toLowerCase();

    if (trimmed.length < MIN_FIELD_LENGTH) {
      warnings.push({
        field,
        message: `"${field}" is very short (${trimmed.length} chars) — future searches may not find this memory`,
      });
      continue;
    }

    if (FILLER_PHRASES.some((phrase) => trimmed === phrase || trimmed.startsWith(phrase + " "))) {
      warnings.push({
        field,
        message: `"${field}" looks like filler text ("${value.trim()}") — consider adding more detail`,
      });
    }
  }

  return warnings;
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export function checkDuplicates(
  db: Database.Database,
  memory: Pick<CodingMemory, "repoId" | "commitSha" | "files" | "intent">
): DuplicateWarning[] {
  const warnings: DuplicateWarning[] = [];
  const existing = getMemoriesByRepoId(db, memory.repoId);

  // Same commit SHA
  if (memory.commitSha) {
    const sameCommit = existing.find((m) => m.commitSha === memory.commitSha);
    if (sameCommit) {
      warnings.push({
        type: "same-commit",
        existingId: sameCommit.id,
        message: `A memory already exists for commit ${memory.commitSha.slice(0, 8)} (${sameCommit.id}) — saving anyway but you may want to delete the old one`,
      });
    }
  }

  // Similar intent + overlapping files
  const fileSet = new Set(memory.files);
  for (const m of existing) {
    if (memory.commitSha && m.commitSha === memory.commitSha) continue; // already caught above
    const fileOverlap = m.files.filter((f) => fileSet.has(f)).length;
    if (fileOverlap === 0) continue;
    const similarity = jaccardSimilarity(memory.intent, m.intent);
    if (similarity >= 0.4) {
      warnings.push({
        type: "similar-intent",
        existingId: m.id,
        message: `A similar memory exists (${m.id}) with ${Math.round(similarity * 100)}% intent similarity on the same files — consider editing it instead`,
      });
      break;
    }
  }

  return warnings;
}
